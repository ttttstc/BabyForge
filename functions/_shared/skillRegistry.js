import { NAIBA_SKILLS, getNaibaSkill, selectNaibaSkill } from '../../src/domain/naibaSkills.js'

export function selectSkillId(message = '', explicitSkillId = '') {
  return selectNaibaSkill(message, explicitSkillId)?.id || 'stage_parenting_qa'
}

export function getSkillContract(skillId) {
  return getNaibaSkill(skillId)
}

export function listSkillContracts() {
  return NAIBA_SKILLS.map((skill) => ({ ...skill, requiredContext: [...skill.requiredContext], contextPolicy: JSON.parse(JSON.stringify(skill.contextPolicy)), tools: [...skill.tools] }))
}
