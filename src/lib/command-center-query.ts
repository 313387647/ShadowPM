const WRITE_PATTERNS = /更新|修改|新增|添加|删除|取消|完成|推进|调整|记账|分配|划拨|拆分|合并|退款|支出|排期|创建/;
const PROJECT_LIST_PATTERNS = /项目列表|哪些项目|有什么项目|所有项目|项目有哪些|现在有哪些项目/;
const PROJECT_HEALTH_PATTERNS = /项目进度|项目状态|项目健康|进展怎么样|进度怎么样|完成情况/;

export function isCommandCenterWriteRequest(input: string) {
  return WRITE_PATTERNS.test(input);
}

export function isProjectListQuery(input: string) {
  return PROJECT_LIST_PATTERNS.test(input);
}

export function isProjectHealthQuery(input: string) {
  return PROJECT_HEALTH_PATTERNS.test(input);
}
