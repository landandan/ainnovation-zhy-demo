import pandas as pd
import numpy as np
import re
import json
import logging
from openai import OpenAI
from concurrent.futures import ThreadPoolExecutor, as_completed
from tqdm import tqdm
import config

# ================= 审计日志配置 =================
# 配置日志输出到本地文件，供后续查阅和审计
logging.basicConfig(
    filename='llm_eval_audit.log',
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] - %(message)s\n' + '-'*60,
    encoding='utf-8'
)

# ================= 配置区域 =================
API_KEY = "sk-xxxxxxxxxxxxxxxxxxxxxxxx"
BASE_URL = "https://api.openai.com/v1" 
MODEL_NAME = "gpt-4o-mini"

client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

FILE_A = 'a.csv'
FILE_B = 'b.csv'
# ============================================

def clean_answer(ans):
    """清洗正确答案，提取 A, B, C, D 或 正确, 错误"""
    if pd.isna(ans): return np.nan
    ans = str(ans).strip()
    match = re.search(r'([A-D]|正确|错误)', ans)
    return match.group(1) if match else ans

def load_and_preprocess(file_path):
    """加载并预处理数据"""
    try:
        df = pd.read_csv(file_path, encoding='utf-8')
    except UnicodeDecodeError:
        df = pd.read_csv(file_path, encoding='gbk')
        
    df['Clean_Ans'] = df['正确答案'].apply(clean_answer)
    df['参考源'] = df.get('解析', df.get('来源', '无参考资料'))
    return df

def run_phase1_stats(df, name):
    """阶段一：严格按照 Notion 表单维度在命令行打印"""
    print(f"\n" + "="*15 + f" 【阶段一】{name} 基础指标诊断 " + "="*15)
    
    # 1. A/B/C/D 答案分布
    mcqs = df[df['Clean_Ans'].isin(['A', 'B', 'C', 'D'])]
    if len(mcqs) > 0:
        ans_dist = mcqs['Clean_Ans'].value_counts(normalize=True)
        dist_str = " | ".join([f"{k}: {ans_dist.get(k, 0)*100:.1f}%" for k in ['A', 'B', 'C', 'D']])
    else:
        dist_str = "无选择题"

    # 2. 判断题真/假比例
    tfs = df[df['Clean_Ans'].isin(['正确', '错误'])]
    if len(tfs) > 0:
        tf_dist = tfs['Clean_Ans'].value_counts(normalize=True)
        tf_str = f"真(正确): {tf_dist.get('正确', 0)*100:.1f}% | 假(错误): {tf_dist.get('错误', 0)*100:.1f}%"
    else:
        tf_str = "无判断题"

    # 3. 选项长度差异警告数 (正确选项比错误选项平均长出 > 10 个字符)
    warning_count = 0
    if len(mcqs) > 0:
        for _, row in mcqs.iterrows():
            ans = row['Clean_Ans']
            opts = {k: str(row.get(f'选项{k}', '')) for k in ['A', 'B', 'C', 'D']}
            opt_lens = {k: len(v) for k, v in opts.items() if v != 'nan' and v != ''}
            
            if ans in opt_lens:
                correct_len = opt_lens[ans]
                incorrect_lens = [v for k, v in opt_lens.items() if k != ans]
                if incorrect_lens and (correct_len - np.mean(incorrect_lens) > 10):
                    warning_count += 1

    # 4. 绝对词包含率
    abs_words = ['均', '都', '完全', '绝不', '一定']
    pattern = '|'.join(abs_words)
    abs_count = df['题目'].astype(str).str.contains(pattern).sum()
    abs_rate = f"{abs_count/len(df)*100:.1f}% ({abs_count} 题)"

    # 打印对齐 Notion 表单的数据
    print(f"[Notion 指标 1] A/B/C/D 答案分布  : {dist_str}")
    print(f"[Notion 指标 2] 判断题真/假比例   : {tf_str}")
    print(f"[Notion 指标 3] 选项长度差异警告数 : {warning_count} 题")
    print(f"[Notion 指标 4] 绝对词包含率       : {abs_rate}")

def evaluate_single_question(row, question_idx, source_name):
    """调用大模型评估单道题目，并记录完整审计日志"""
    is_mcq = str(row['Clean_Ans']) in ['A', 'B', 'C', 'D']
    option_hint = "请分别点评正确选项是否严谨，以及每个错误选项（干扰项）的迷惑性如何，指出是否存在明显的凑数痕迹。" if is_mcq else "请点评判断题的题干表述是否有歧义，对/错的判定是否绝对严谨。"

    prompt = f"""你是一个资深的考试命题专家。请严格根据提供的【参考资料】，评估以下【题目】的质量，并给出评分和选项分析。

评分标准：
1分: 存在事实错误，或答案与资料矛盾。
2分: 事实无误，但错误选项明显凑数（如语法不通、常识即可排除）。
3分: 中规中矩，无明显错误，但迷惑性不足。
4分: 质量较好，考点核心，选择题错误选项有一定迷惑性。
5分: 高质量题目，选项极具迷惑性，完美符合人类出题习惯。

【参考资料】：
{row['参考源']}

【题目】：
类型: {row.get('题型', '未知')}
题干: {row['题目']}
选项A: {row.get('选项A', '')} | 选项B: {row.get('选项B', '')} | 选项C: {row.get('选项C', '')} | 选项D: {row.get('选项D', '')}
正确答案: {row['Clean_Ans']}

请务必按以下 JSON 格式输出：
{{
  "score": 评分数字(1-5),
  "reason": "整体评分的理由简述(50字以内)",
  "option_analysis": "{option_hint}"
}}"""
    
    req_id = f"[{source_name} - Row {question_idx}]"
    # 记录 Request 日志
    logging.info(f"REQUEST {req_id}\n{prompt}")

    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": prompt}],
            response_format={ "type": "json_object" }, 
            temperature=0.3
        )
        raw_content = response.choices[0].message.content
        
        # 记录 Response 日志
        logging.info(f"RESPONSE {req_id}\n{raw_content}")
        
        result = json.loads(raw_content)
        return result.get('score', 0), result.get('reason', ''), result.get('option_analysis', '')
    except Exception as e:
        # 记录报错日志
        error_msg = str(e)
        logging.error(f"ERROR {req_id}\n{error_msg}")
        return 0, f"API Error: {error_msg}", ""

def run_phase2_llm_judge(df, name):
    """阶段二：并发执行 LLM 裁判打分"""
    print(f"\n" + "="*15 + f" 【阶段二】{name} LLM裁判打分 " + "="*15)
    
    scores = []
    reasons = []
    option_analyses = []
    
    with ThreadPoolExecutor(max_workers=5) as executor:
        # 传入 index(题号) 和 name(题库名) 方便在日志中追踪溯源
        futures = {executor.submit(evaluate_single_question, row, idx, name): idx for idx, row in df.iterrows()}
        
        for future in tqdm(as_completed(futures), total=len(futures), desc=f"评估 {name}"):
            score, reason, option_analysis = future.result()
            scores.append(score)
            reasons.append(reason)
            option_analyses.append(option_analysis)
            
    df['LLM_Score'] = scores
    df['LLM_Reason'] = reasons
    df['LLM_Option_Analysis'] = option_analyses
    
    valid_scores = [s for s in scores if s > 0]
    avg_score = np.mean(valid_scores) if valid_scores else 0
    high_quality_ratio = sum(1 for s in valid_scores if s >= 4) / len(valid_scores) * 100 if valid_scores else 0
    
    print(f"-> 平均得分: {avg_score:.2f} / 5.0")
    print(f"-> 优质题目(>=4分)占比: {high_quality_ratio:.1f}%")
    
    output_file = f"{name}_evaluated.csv"
    df.to_csv(output_file, index=False, encoding='utf-8-sig')
    print(f"-> 详细评估报告已保存至: {output_file}")
    print(f"-> 审计日志已写入: llm_eval_audit.log")

def main():
    # 1. 加载数据
    df_a = load_and_preprocess(FILE_A)
    df_b = load_and_preprocess(FILE_B)
    
    # 2. 执行统计检查 (将直接在命令行打印出对齐 Notion 表单的数据)
    run_phase1_stats(df_a, "题库 A")
    run_phase1_stats(df_b, "题库 B")
    
    # 3. 执行大模型打分 (并写入日志)
    # 为节省时间，建议初次调试使用 df_a.head(5) 测试前 5 条
    # run_phase2_llm_judge(df_a, "题库 A")
    # run_phase2_llm_judge(df_b, "题库 B")

if __name__ == "__main__":
    main()