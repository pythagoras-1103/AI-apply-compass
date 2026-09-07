import { normalizeChecklist, normalizeSchool } from "./checklistUtils.js";

export const fallbackSchools = {
  NYU: [
    {
      name: "高中成绩单",
      description: "由学校官方出具并盖章；非英文版本通常需要准备认证翻译件。",
      deadline: ""
    },
    {
      name: "个人文书 Essay",
      description: "完成 Common App 主文书，并按学校要求补充 NYU 专属短文。",
      deadline: ""
    },
    {
      name: "推荐信",
      description: "提前联系任课老师或升学顾问，说明申请方向和个人亮点。",
      deadline: ""
    },
    {
      name: "语言成绩",
      description: "托福、雅思、多邻国等英语能力证明，按官网最新要求提交。",
      deadline: ""
    },
    {
      name: "标准化考试成绩",
      description: "SAT 或 ACT 是否提交取决于当年政策和个人申请策略。",
      deadline: ""
    }
  ],
  UCL: [
    {
      name: "UCAS 申请表",
      description: "通过 UCAS 填写课程选择、教育经历、个人资料和考试信息。",
      deadline: ""
    },
    {
      name: "Personal Statement",
      description: "围绕专业兴趣、学术准备、相关经历和未来目标撰写个人陈述。",
      deadline: ""
    },
    {
      name: "学术推荐信",
      description: "通常由学校老师或升学顾问通过 UCAS 系统提交。",
      deadline: ""
    },
    {
      name: "成绩单与预估分",
      description: "提交已有成绩，并由学校提供 A-Level、IB 或同等课程预估分。",
      deadline: ""
    },
    {
      name: "英语语言证明",
      description: "雅思、托福或其他被认可的英语成绩，具体分数按专业要求准备。",
      deadline: ""
    }
  ],
  港大: [
    {
      name: "网上申请表",
      description: "在 HKU 申请系统填写个人资料、课程志愿、教育背景和活动经历。",
      deadline: ""
    },
    {
      name: "高中成绩单",
      description: "上传最近三年成绩单，建议准备学校盖章版本。",
      deadline: ""
    },
    {
      name: "个人陈述",
      description: "说明选择专业的原因、个人优势、重要经历和未来规划。",
      deadline: ""
    },
    {
      name: "推荐信",
      description: "邀请熟悉你学术表现的老师撰写，并预留提交时间。",
      deadline: ""
    },
    {
      name: "语言与公开考试成绩",
      description: "提交高考、A-Level、IB、SAT、ACT、托福或雅思等适用成绩。",
      deadline: ""
    }
  ]
};

export function getFallbackChecklist(school) {
  const normalized = normalizeSchool(school);
  const key = Object.keys(fallbackSchools).find((name) => normalizeSchool(name) === normalized);
  return key ? normalizeChecklist(fallbackSchools[key]) : null;
}

export function getFallbackSchoolNames() {
  return Object.keys(fallbackSchools);
}

