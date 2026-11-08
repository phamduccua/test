import { acidBase, dissolution, waterReactions } from './basic'
import { exchange } from './exchange'
import { metalAcid, metalSalt } from './metals'
import { decomposition, halogen, peroxide, redoxTable } from './redox'
import type { Rule } from './types'

/** Thứ tự ưu tiên (số nhỏ chạy trước). */
export const RULES: Rule[] = [dissolution, waterReactions, redoxTable, acidBase, metalAcid, metalSalt, halogen, exchange, decomposition, peroxide].sort(
  (a, b) => a.priority - b.priority,
)
