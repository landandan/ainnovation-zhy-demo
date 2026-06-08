/**
 * Mock API 模块 —— 模拟 Dify SSE 流式响应
 * 用于前端开发调试，无需配置后端即可测试完整交互流程
 */

/* ───── Mock 回答库（按智能体 id 分类） ───── */

const MOCK_RESPONSES: Record<string, string[]> = {
  knowledge: [
    `📚 **海油知识库检索结果**

根据《海洋石油安全管理规程》第 3 章第 12 条：

> 所有进入海上平台作业区域的人员，必须穿戴符合国家标准的**防静电工作服**、**安全帽**和**防滑工鞋**。在含硫化氢（H₂S）风险区域，还需佩戴便携式 H₂S 检测仪和正压式空气呼吸器。

**关键数据：**
- 平台紧急集合点：每个甲板层 ≥ 2 个
- 救生艇容量：额定乘员 × 1.5 倍
- 消防泵最小流量：150 m³/h

> 💡 提示：如需查阅完整规程，可前往 DCC 文档中心下载 PDF。`,

    `📋 **井控安全知识库**

**关井程序（硬关井法）—— API RP 59 标准：**

1. 发现溢流 → 立即停泵，上提方钻杆
2. 打开液动放喷阀（HCR 阀）
3. 关闭环形防喷器（BOP）
4. 关闭闸板防喷器
5. 关闭节流管汇，记录关井立压/套压
6. 通知监督并启动应急预案

**溢流允许量：**
| 井深 (m) | 最大溢流量 (bbl) |
|----------|-------------------|
| < 2000   | 15               |
| 2000~4000 | 20              |
| > 4000   | 25               |

⚠️ 一旦溢流超过允许量，立即启动**溢流应急响应**。`,

    `⚙️ **CEP 平台工艺流程**

**生产分离器（V-101A/B）运行参数：**
- 操作压力：0.8 ~ 1.2 MPa
- 操作温度：55 ~ 72°C
- 液位设定：45% ~ 65%（LLSD 40%, HHSD 75%）
- 油水界面控制：RADAR + 核密度计冗余

**化学注入点：**
| 位置        | 药剂        | 注入量 (ppm) |
|------------|------------|-------------|
| 井口管汇   | 破乳剂      | 15 ~ 25    |
| 分离器入口  | 消泡剂      | 3 ~ 8      |
| 外输泵入口  | 防蜡剂      | 50 ~ 100   |

🔧 维护周期：分离器内部检查——每 18 个月。`,
  ],

  inspection: [
    `🔍 **AI 智能巡检报告 —— N-1 压缩机单元**

巡检时间：2026-06-04 09:30 CST  
巡检人员：自动巡检系统

| 检查项         | 状态   | 数值       | 阈值         |
|---------------|--------|-----------|--------------|
| 轴承温度       | ✅ 正常 | 62°C      | < 75°C       |
| 振动烈度       | ⚠️ 预警 | 4.7 mm/s  | ≤ 4.5 mm/s   |
| 润滑油压力     | ✅ 正常 | 0.32 MPa  | 0.25~0.40 MPa|
| 排气温度       | ✅ 正常 | 108°C     | < 130°C      |
| 油过滤器压差   | ❌ 超标 | 1.8 bar   | ≤ 1.5 bar    |

**智能诊断建议：**
1. ⚠️ 油过滤器压差超标，建议**24 小时内**更换滤芯（件号：F-1047-P）
2. ⚠️ 振动值略超限，建议下一轮巡检时复测并做频谱分析
3. 🔧 该压缩机累计运行已达 8200 小时，距 B 保还有 200 小时

📎 自动生成工单 #WO-2026-0604-003，已推送至维修班组。`,

    `🔍 **AI 智能巡检 —— 电潜泵（ESP）P-07 井**

| 参数           | 值         | 状态   | 趋势     |
|---------------|-----------|--------|----------|
| 运行频率       | 48.5 Hz   | ✅     | → 稳定   |
| 井下压力       | 12.3 MPa  | ✅     | → 稳定   |
| 马达温度       | 118°C     | ⚠️     | ↑ 上升   |
| 绝缘电阻       | 2.1 MΩ    | ✅     | → 稳定   |
| 三相电流偏差   | 2.8%      | ✅     | → 稳定   |
| 泵效           | 62%       | ⚠️     | ↓ 下降   |

**AI 分析：**
- 泵效连续 3 天下降（65%→62%），结合马达温度上升趋势，判断可能存在**叶轮磨损**或**气锁**现象
- 建议：调整运行频率至 46 Hz 观察 24h，若泵效继续下降需安排起泵检查

📊 历史趋势对比图已生成 → [点击查看]`,

    `📋 **当日巡检总览**

已完成巡检点：24 / 28（85.7%）

| 区域       | 状态   | 异常项 |
|-----------|--------|--------|
| A 区-井口  | ✅ 完成 | 0      |
| B 区-分离  | ⚠️ 进行中 | 1    |
| C 区-压缩  | ✅ 完成 | 1      |
| D 区-外输  | ⭕ 待巡检 | -     |

**待处理异常汇总：**
1. B 区-油过滤器压差高 → 工单 #003
2. C 区-振动预警 → 待复测

📅 下轮巡检时间：2026-06-04 14:00`,
  ],

  repair: [
    `🔧 **AI 随身老师傅 —— 故障诊断**

**故障现象：** 生产分离器液位波动剧烈，自动控制无法稳定

**可能原因分析（概率排序）：**

1. **液位变送器导压管堵塞** (55%)
   - 症状：液位显示大幅跳动，间歇性失准
   - 处理：隔离变送器 → 排污冲洗导压管 → 回装校验
   - 所需工具：防爆扳手、排污桶、校验仪
   - 参考 SP-1503 规程第 4.2 节

2. **油水界面乳化层过厚** (30%)
   - 症状：液位缓慢漂移，调整破乳剂后逐步恢复
   - 处理：提高破乳剂注入量至 30 ppm，观察 2h
   - 参考：化学药剂注入方案 CHM-2024

3. **控制阀定位器故障** (15%)
   - 症状：阀位反馈与实际不符
   - 处理：检查 I/P 转换器及气源压力

> 🛠️ **维修注意事项：** 操作前须办理热工/冷工作业票，隔离相关设备并挂"禁止操作"警示牌。`,

    `🛠️ **燃气轮机（GT-201）启动故障排查**

**故障代码：** IGV-003（进口导叶位置偏差）

**逐步排查指南：**

1. **检查液压油系统** ✅
   - 油箱液位：正常（82%）
   - 油泵出口压力：12.5 MPa（正常范围 12~14 MPa）
   - 结论：液压系统正常

2. **检查 IGV 执行器反馈** →
   - 用 HART 手操器读取 LVDT 反馈值
   - 全关位：4.03 mA（正常 4.00±0.05 mA）⚠️ 略偏
   - 全开位：19.92 mA（正常 20.00±0.05 mA）
   - **需要重新校准 IGV LVDT 零位/满位**

3. **校准步骤：**
   - 停机状态下，手动摇至全关机械止点
   - 调整 LVDT 零位 → 4.00 mA
   - 摇至全开 → 调整满位 → 20.00 mA
   - 重复 3 次验证回差 < 0.5%

🔖 关联知识：燃气轮机控制系统手册 CH11-IGV Calibration`,

    `📘 **维修知识图谱 —— API 610 离心泵**

**常见故障模式：**

| 故障               | 原因           | 对策               |
|-------------------|---------------|-------------------|
| 振动超标           | 叶轮不平衡     | 动平衡校正/更换     |
| 机械密封泄漏       | 端面磨损       | 更换密封副 + 冲洗方案 |
| 流量/扬程不足       | 口环间隙过大   | 更换口环（间隙 ≤0.3mm）|
| 轴承温度高         | 润滑脂过多/过少 | 重新加注（壳牌Gadus S2）|

**维修记录查询：** 该泵上次大修 2025-11-15，更换机械密封（件号 MS-610-80）。
📦 备件库存：机械密封 ×1，轴承 ×2，O 型圈套件 ×3。`,
  ],

  report: [
    `📊 **生产日报 —— 2026年6月4日**

**产量数据：**

| 项目           | 计划值    | 实际值    | 完成率   |
|---------------|----------|----------|----------|
| 日产油 (bbl)   | 12,500   | 12,683   | 101.5%  |
| 日产气 (Mscf)  | 8,200    | 8,150    | 99.4%   |
| 日注水 (bbl)   | 15,000   | 14,892   | 99.3%   |
| 外输原油 (bbl)  | 12,500   | 12,680   | 101.4%  |

**运行摘要：**
- 开井数：18 口（生产井 15，注水井 3）
- 今日关停井：B-08（环空压力异常，已通知油藏）
- 设备运行时率：97.2%
- HSE 事件：0

**明日计划：**
- B-08 井环空泄压作业
- GT-201 IGV 执行器校准
- 月度消防演习 10:00 AM

> 📋 日报已自动生成，请核对后提交至生产指挥系统。`,

    `📈 **周生产统计 —— W22 (05/29 - 06/04)**

**累计产量：**

| 指标            | 计划     | 实际     | 完成率   |
|----------------|---------|---------|----------|
| 周累产油 (bbl)  | 87,500  | 88,120  | 100.7%  |
| 周累产气 (Mscf) | 57,400  | 56,980  | 99.3%   |
| 周累注水 (bbl)  | 105,000 | 104,600 | 99.6%   |

**关键事件汇总：**
- 06/01：完成 N-1 压缩机 B 级保养
- 06/02-03：P-07 井泵效下降，已调频处理
- 06/04：B-08 井环空压力异常，环空泄压中

**下周计划（W23）：**
- P-07 井泵效跟踪评估
- GT-201 振动传感器更换
- 月度 H2S 应急演练`,

    `📝 **交接班记录**

**交班班组：** A 班（2026-06-04 07:00）

**运行状态概述：**
所有核心生产系统运行正常。CEP 平台日产油 12,683 bbl，各井口、分离、压缩、外输单元均在正常操作范围内。

**重点关注事项：**
1. B-08 井环空压力 1,850 psi（正常 1,200~1,500 psi），油藏部门已确认持续泄压作业并进行环空流体取样分析
2. N-1 压缩机运行平稳，B 保后各项参数均在正常范围
3. 消防泵房 2 号柴油机启动了 3 次才成功，已列入维护工单

**设备变更 / 作业票：**
- PTW-240：GT-201 IGV 执行器校准（进行中）
- PTW-241：消防泵 2 号柴油机故障排查（待开始）
- 无 MOC（变更管理）事项

**接班班组：** B 班   **交班时间：** 19:00
> 📋 以上信息已同步至交接班日志系统。`,
  ],
}

/* ───── 流式 Mock 回答（模拟 SSE 逐字吐出） ───── */

/**
 * 生成一个 ReadableStream，模拟 Dify SSE 流式响应
 */
export function createMockStream(
  agentId: string,
  userText: string,
  conversationId?: string | null,
): ReadableStream<Uint8Array> {
  const responses = MOCK_RESPONSES[agentId] || MOCK_RESPONSES.knowledge || ["Mock response"]

  // 根据用户输入选择不同的回答
  const idx =
    userText.length > 10
      ? (userText.charCodeAt(0) + userText.charCodeAt(userText.length - 1)) % responses.length
      : Date.now() % responses.length
  const fullAnswer = responses[idx]

  const mockConversationId =
    conversationId || `mock-conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  // 模拟思考延迟（800~1500ms 后开始吐字）
  const thinkDelay = 800 + Math.random() * 700

  // 模拟打字速度（每个字符 15~35ms）
  const charDelay = 15 + Math.random() * 20

  let cancelled = false
  const encoder = new TextEncoder()

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let currentIndex = 0
      const chars = Array.from(fullAnswer) // 正确处理多字节字符（如 emoji）
      const startTime = Date.now()

      // SSE 格式化工具
      const sendSSE = (event: string, data: Record<string, unknown>) => {
        if (cancelled) return
        const line = `data: ${JSON.stringify({ event, ...data })}\n\n`
        controller.enqueue(encoder.encode(line))
      }

      const run = async () => {
        // ⏳ 模拟思考延迟
        await sleep(thinkDelay)
        if (cancelled) return

        // 🚀 先发送 workflow_started 事件（模拟工作流启动）
        sendSSE("workflow_started", {
          workflow_run_id: `mock-wf-${Date.now()}`,
          task_id: `mock-task-${Date.now()}`,
          data: {
            id: `mock-wf-${Date.now()}`,
            workflow_id: "mock-workflow-1",
            created_at: Date.now() / 1000,
          },
        })

        await sleep(200)
        if (cancelled) return

        // 📤 逐字发送 message 事件
        const chunkSize = 3 // 每次发送 3 个字符
        const messageId = `mock-msg-${Date.now()}`

        while (currentIndex < chars.length) {
          const chunk = chars.slice(currentIndex, currentIndex + chunkSize).join("")
          sendSSE("message", {
            message_id: messageId,
            conversation_id: mockConversationId,
            answer: chunk,
            created_at: (startTime + Date.now() - startTime) / 1000,
          })
          currentIndex += chunkSize

          // 模拟不稳定的网络速度
          const jitter = (Math.random() - 0.5) * 10
          await sleep(charDelay * chunkSize + jitter)

          if (cancelled) return
        }

        // ✅ 发送 message_end 事件
        await sleep(50)
        sendSSE("message_end", {
          message_id: messageId,
          conversation_id: mockConversationId,
          metadata: {
            usage: {
              prompt_tokens: Math.floor(Math.random() * 500) + 200,
              completion_tokens: fullAnswer.length,
              total_tokens: Math.floor(Math.random() * 500) + 200 + fullAnswer.length,
            },
          },
        })

        controller.close()
      }

      run().catch(() => {
        if (!cancelled) controller.close()
      })
    },

    cancel() {
      cancelled = true
    },
  })
}

/**
 * 快速阻塞式 Mock 回答（非流式，用于快速测试）
 */
export function createMockBlockingResponse(
  agentId: string,
  userText: string,
  conversationId?: string | null,
): {
  answer: string
  conversation_id: string
  message_id: string
} {
  const responses = MOCK_RESPONSES[agentId] || MOCK_RESPONSES.knowledge || ["Mock response"]
  const idx =
    userText.length > 10
      ? (userText.charCodeAt(0) + userText.charCodeAt(userText.length - 1)) % responses.length
      : Date.now() % responses.length

  return {
    answer: responses[idx],
    conversation_id:
      conversationId || `mock-conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message_id: `mock-msg-${Date.now()}`,
  }
}

/* ───── 工具函数 ───── */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}