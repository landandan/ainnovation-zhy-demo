/**
 * 工作流进度状态管理
 */

export interface WorkflowNode {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  startedAt?: number
  completedAt?: number
  duration?: number
}

export interface WorkflowProgress {
  status: 'idle' | 'running' | 'completed' | 'error'
  nodes: WorkflowNode[]
  currentNodeIndex: number
  totalNodes: number
  progressPercent: number
  startedAt?: number
  estimatedRemainingTime?: number
  errorMessage?: string
  taskId?: string
}

/**
 * 创建初始进度状态
 */
export function createInitialProgress(): WorkflowProgress {
  return {
    status: 'idle',
    nodes: [],
    currentNodeIndex: 0,
    totalNodes: 0,
    progressPercent: 0,
  }
}

/**
 * 处理 workflow_started 事件
 */
export function handleWorkflowStarted(
  progress: WorkflowProgress,
  event: any
): WorkflowProgress {
  const nodes: WorkflowNode[] = []
  
  // 尝试从事件中提取节点信息
  if (event.data && event.data.nodes) {
    event.data.nodes.forEach((node: any, index: number) => {
      nodes.push({
        id: node.id || `node-${index}`,
        name: node.title || node.name || `节点 ${index + 1}`,
        status: index === 0 ? 'running' : 'pending',
      })
    })
  }

  return {
    ...progress,
    status: 'running',
    nodes: nodes.length > 0 ? nodes : [
      { id: 'node-1', name: '初始化工作流', status: 'running' },
      { id: 'node-2', name: '数据处理', status: 'pending' },
      { id: 'node-3', name: '生成响应', status: 'pending' },
    ],
    currentNodeIndex: 0,
    totalNodes: nodes.length > 0 ? nodes.length : 3,
    progressPercent: 0,
    startedAt: Date.now(),
    taskId: event.task_id,
  }
}

/**
 * 处理 node_started 事件
 */
export function handleNodeStarted(
  progress: WorkflowProgress,
  event: any
): WorkflowProgress {
  let nodes = [...progress.nodes]
  let currentNodeIndex = progress.currentNodeIndex
  
  // 查找节点或创建新节点
  const nodeId = event.data?.node_id || event.node_id
  let nodeIndex = nodes.findIndex(n => n.id === nodeId)
  
  if (nodeIndex === -1) {
    // 如果找不到节点，添加到末尾
    const nodeName = event.data?.title || event.data?.name || `节点 ${nodes.length + 1}`
    nodes.push({
      id: nodeId || `node-${nodes.length + 1}`,
      name: nodeName,
      status: 'running',
      startedAt: Date.now(),
    })
    nodeIndex = nodes.length - 1
  } else {
    // 更新现有节点状态
    nodes[nodeIndex] = {
      ...nodes[nodeIndex],
      status: 'running',
      startedAt: Date.now(),
    }
  }
  
  // 标记之前的节点为完成
  for (let i = 0; i < nodeIndex; i++) {
    if (nodes[i].status === 'running' || nodes[i].status === 'pending') {
      nodes[i] = { ...nodes[i], status: 'completed' }
    }
  }
  
  currentNodeIndex = nodeIndex
  const totalNodes = Math.max(progress.totalNodes, nodes.length)
  const progressPercent = Math.round((currentNodeIndex / totalNodes) * 100)
  
  // 估算剩余时间
  let estimatedRemainingTime: number | undefined
  if (progress.startedAt) {
    const elapsed = Date.now() - progress.startedAt
    if (progressPercent > 0) {
      estimatedRemainingTime = Math.round((elapsed / progressPercent) * (100 - progressPercent))
    }
  }
  
  return {
    ...progress,
    status: 'running',
    nodes,
    currentNodeIndex,
    totalNodes,
    progressPercent,
    estimatedRemainingTime,
  }
}

/**
 * 处理 node_finished 事件
 */
export function handleNodeFinished(
  progress: WorkflowProgress,
  event: any
): WorkflowProgress {
  let nodes = [...progress.nodes]
  
  // 查找节点
  const nodeId = event.data?.node_id || event.node_id
  let nodeIndex = nodes.findIndex(n => n.id === nodeId)
  
  if (nodeIndex === -1) {
    // 如果找不到节点，使用当前节点
    nodeIndex = progress.currentNodeIndex
  }
  
  if (nodeIndex >= 0 && nodeIndex < nodes.length) {
    const node = nodes[nodeIndex]
    const completedAt = Date.now()
    const duration = node.startedAt ? completedAt - node.startedAt : undefined
    
    nodes[nodeIndex] = {
      ...node,
      status: 'completed',
      completedAt,
      duration,
    }
  }
  
  return {
    ...progress,
    nodes,
  }
}

/**
 * 处理 workflow_finished 事件
 */
export function handleWorkflowFinished(
  progress: WorkflowProgress
): WorkflowProgress {
  const nodes = progress.nodes.map(node => ({
    ...node,
    status: node.status === 'running' ? 'completed' : node.status,
  }))
  
  return {
    ...progress,
    status: 'completed',
    nodes,
    currentNodeIndex: nodes.length,
    progressPercent: 100,
    estimatedRemainingTime: 0,
  }
}

/**
 * 处理 error 事件
 */
export function handleWorkflowError(
  progress: WorkflowProgress,
  event: any
): WorkflowProgress {
  const nodes = progress.nodes.map((node, index) => {
    if (index === progress.currentNodeIndex) {
      return {
        ...node,
        status: 'error',
        completedAt: Date.now(),
      }
    }
    return node
  })
  
  return {
    ...progress,
    status: 'error',
    nodes,
    errorMessage: event.message || '工作流执行出错',
  }
}

/**
 * 处理用户主动停止工作流。
 */
export function handleWorkflowStopped(
  progress: WorkflowProgress,
  message = "流程已停止"
): WorkflowProgress {
  if (progress.status === "idle") {
    return progress
  }

  const nodes = progress.nodes.map((node, index) => {
    if (index === progress.currentNodeIndex && node.status === "running") {
      return {
        ...node,
        status: "error" as const,
        completedAt: Date.now(),
      }
    }
    return node
  })

  return {
    ...progress,
    status: "error",
    nodes,
    errorMessage: message,
  }
}

/**
 * 格式化时间（毫秒 -> 可读格式）
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}
