import {COLORS} from './theme'

export type FilmScene = {
  id: string
  number: string
  label: string
  title: string
  caption: string
  evidence: readonly string[]
  durationSeconds: number
  accent: string
  zoom: number
  focusX: number
  focusY: number
}

export const SCENES: readonly FilmScene[] = [
  {
    id: 'overview',
    number: '01',
    label: '统一入口',
    title: '一个意图，进入银行控制面',
    caption: '助理整理候选计划，风险、授权和执行边界仍由银行服务端掌握。',
    evidence: ['自然语言', '候选计划', '服务端控制'],
    durationSeconds: 14,
    accent: COLORS.cobalt,
    zoom: 1.02,
    focusX: 50,
    focusY: 50,
  },
  {
    id: 'transactions',
    number: '02',
    label: '只读查询',
    title: '先看清事实，再讨论判断',
    caption: '余额、交易与异常线索由服务端返回；界面不推测，也不补全事实。',
    evidence: ['余额', '交易明细', 'Trace ID'],
    durationSeconds: 14,
    accent: COLORS.teal,
    zoom: 1.32,
    focusX: 43,
    focusY: 24,
  },
  {
    id: 'products',
    number: '03',
    label: '理财比较',
    title: '每个数字，都带着风险语境',
    caption: '风险等级、起购金额、期限与业绩基准并列呈现，不把参考收益包装成承诺。',
    evidence: ['产品事实', '风险等级', '不承诺收益'],
    durationSeconds: 13,
    accent: COLORS.cobalt,
    zoom: 1.34,
    focusX: 42,
    focusY: 24,
  },
  {
    id: 'cards',
    number: '04',
    label: '卡片控制',
    title: '卡片变更，也走同一套授权',
    caption: '冻结、额度调整、交易限制与挂失，都必须先形成服务端动作。',
    evidence: ['卡片状态', '动作快照', '审计记录'],
    durationSeconds: 13,
    accent: COLORS.amber,
    zoom: 1.32,
    focusX: 42,
    focusY: 24,
  },
  {
    id: 'subscriptions',
    number: '05',
    label: '订阅代扣',
    title: '周期扣费，有凭据也有下一步',
    caption: '服务端识别周期、金额与续费日期；取消订阅继续进入确认与回执流程。',
    evidence: ['续费提醒', '取消动作', '业务回执'],
    durationSeconds: 12,
    accent: COLORS.teal,
    zoom: 1.32,
    focusX: 44,
    focusY: 24,
  },
  {
    id: 'liquidity',
    number: '06',
    label: '流动性预检',
    title: '先算清楚，再决定是否锁定',
    caption: '未来 30 天现金流、最低余额与必要支出缓冲，全部由服务端推演。',
    evidence: ['30 天曲线', '安全预算', '只读预检'],
    durationSeconds: 15,
    accent: COLORS.teal,
    zoom: 1.34,
    focusX: 84,
    focusY: 32,
  },
  {
    id: 'workflow',
    number: '07',
    label: '跨场景工作流',
    title: '复杂目标，拆成可授权节点',
    caption: '创建不等于执行。每个节点按依赖推进，并重新经过确认、MFA 或人工接管。',
    evidence: ['依赖关系', '逐节点推进', '逐项授权'],
    durationSeconds: 14,
    accent: COLORS.cobalt,
    zoom: 1.34,
    focusX: 43,
    focusY: 25,
  },
  {
    id: 'transfer-confirm',
    number: '08',
    label: '黄色动作',
    title: '动作先冻结，用户再确认',
    caption: '金额、收款人、备注与风险等级进入不可变快照；确认只对当前 Action ID 有效。',
    evidence: ['不可变快照', '显式确认', '一次性执行门'],
    durationSeconds: 18,
    accent: COLORS.amber,
    zoom: 1.5,
    focusX: 86,
    focusY: 30,
  },
  {
    id: 'transfer-mfa',
    number: '09',
    label: '红色动作',
    title: '高风险操作，升级为 MFA',
    caption: '验证码绑定单个 Action ID。验证通过后，执行仍要经过服务端闸门。',
    evidence: ['Action-bound MFA', '一次性执行', '服务端回执'],
    durationSeconds: 14,
    accent: COLORS.red,
    zoom: 1.5,
    focusX: 86,
    focusY: 30,
  },
  {
    id: 'audit',
    number: '10',
    label: '审计链',
    title: '每一步判断，都留下证据',
    caption: '动作创建、MFA、执行门与最终结果按时间排序；敏感字段在展示前脱敏。',
    evidence: ['动作创建', 'MFA 结果', '最终回执'],
    durationSeconds: 16,
    accent: COLORS.cobalt,
    zoom: 1.62,
    focusX: 86,
    focusY: 22,
  },
  {
    id: 'security',
    number: '11',
    label: '安全边界',
    title: '提示注入，改不了权限',
    caption: '模型可以提出计划，但风险、授权、执行与结果始终由银行服务端决定。',
    evidence: ['不可信输入', '未创建动作', '服务端裁决'],
    durationSeconds: 12,
    accent: COLORS.red,
    zoom: 1.28,
    focusX: 42,
    focusY: 22,
  },
] as const

export const INTRO_SECONDS = 17
export const OUTRO_SECONDS = 10
