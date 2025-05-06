import { WhereExpressionBuilder } from 'typeorm';
import { IOptionsObject } from './interfaces';

/**
 * Interface for WhereBuilder to break circular dependencies
 */
export interface IWhereBuilder {
  parseFilterString(filterString: string): object[];
  applyWhereConditions(
    qb: WhereExpressionBuilder,
    conditions: { [key: string]: any },
    alias: string,
  ): void;
}

/**
 * Factory function to create a WhereBuilder instance
 */
export function createWhereBuilder(options: IOptionsObject): IWhereBuilder {
  // Import dynamically to avoid circular dependencies
  const { WhereBuilder } = require('./where-builder');
  return new WhereBuilder(options);
} 