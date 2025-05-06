import { isMatch } from 'date-fns';
import {
  Between,
  In,
  IsNull,
  LessThan,
  LessThanOrEqual,
  Like,
  MoreThan,
  MoreThanOrEqual,
  Not,
} from 'typeorm';
import { EDateType, ILooseObject, IOptionsObject } from './interfaces';

/**
 * Parse a string value to a number or date if applicable
 */
export function parseDateOrNumber(value: string): number | string {
  if (isMatch(value, EDateType.Date) || isMatch(value, EDateType.Datetime)) {
    return value;
  }
  
  // Try to parse as a number
  const num = Number(value);
  if (!isNaN(num)) {
    return num; // Return as actual number, not string
  }
  
  return value;
}

/**
 * Determine if a query parameter value is valid
 */
export function isValidParam(value: string | undefined): boolean {
  return !!value;
}

/**
 * Deep merge two objects
 */
export function mergeDeep(target: any, source: any): any {
  const isObject = (obj: any) => obj && typeof obj === 'object';

  if (!isObject(target) || !isObject(source)) {
    return source;
  }

  Object.keys(source).forEach((key) => {
    const targetValue = target[key];
    const sourceValue = source[key];

    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      target[key] = targetValue.concat(sourceValue);
    } else if (isObject(targetValue) && isObject(sourceValue)) {
      target[key] = mergeDeep(Object.assign({}, targetValue), sourceValue);
    } else {
      target[key] = sourceValue;
    }
  });

  return target;
}

/**
 * Create a where object based on field, operator, value, and not flag
 */
export function createWhereObject(
  field: string,
  operator: string,
  value: string,
  notOperator: boolean,
  options: IOptionsObject
): ILooseObject {
  const obj: ILooseObject = {};
  let finalValue;

  // Handle direct not equals operator
  if (operator === options.NOT_EQUALS) {
    // Always use Not with the parsed value
    const parsedValue = parseDateOrNumber(value);
    const notValue = Not(parsedValue);
    // Mark for special handling to ensure proper SQL generation
    return { [field]: Object.assign(notValue, { _requiresNotEquals: true }) };
  }

  switch (operator) {
    case options.EXACT:
      finalValue = parseDateOrNumber(value);
      break;
    case options.CONTAINS:
      finalValue = Like(`%${value}%`);
      break;
    case options.STARTS_WITH:
      finalValue = Like(`${value}%`);
      break;
    case options.ENDS_WITH:
      finalValue = Like(`%${value}`);
      break;
    case options.IS_NULL:
      finalValue = 'IS_NULL'; // Special marker for IS NULL condition
      break;
    case options.GT:
      finalValue = MoreThan(parseDateOrNumber(value));
      break;
    case options.GTE:
      finalValue = MoreThanOrEqual(parseDateOrNumber(value));
      break;
    case options.LT:
      finalValue = LessThan(parseDateOrNumber(value));
      break;
    case options.LTE:
      finalValue = LessThanOrEqual(parseDateOrNumber(value));
      break;
    case options.IN:
      finalValue = In(value.split(options.VALUE_DELIMITER!).map(v => parseDateOrNumber(v)));
      break;
    case options.BETWEEN:
      const [start, end] = value.split(options.VALUE_DELIMITER!);
      finalValue = Between(parseDateOrNumber(start), parseDateOrNumber(end));
      break;
    default:
      finalValue = value;
  }

  // If it's a NOT operator with the EXACT operator, always use Not with parsed value
  if (notOperator && operator === options.EXACT) {
    const notValue = Not(parseDateOrNumber(value));
    // Mark for special handling to ensure proper SQL generation
    obj[field] = Object.assign(notValue, { _requiresNotEquals: true });
  } else if (notOperator) {
    // For all other NOT operators
    const notValue = Not(finalValue);
    // Mark for special handling to ensure proper SQL generation
    obj[field] = Object.assign(notValue, { _requiresNotEquals: true });
  } else {
    obj[field] = finalValue;
  }
  
  return obj;
}

/**
 * Get entity columns for a given entity name
 */
export function getEntityColumns(entityName: string): string[] {
  // This is a simplified approach - in a real implementation, you would
  // get this information from TypeORM metadata or a schema definition
  const columnMap: { [key: string]: string[] } = {
    status: [
      'id',
      'name',
      'color',
      'order',
      'categoryId',
      'spaceId',
      'fileId',
      'folderId',
      'deletedAt',
      'createdAt',
      'updatedAt',
      'clickupId',
    ],
    owner: [
      'id',
      'jobTitle',
      'centralId',
      'email',
      'firstName',
      'lastName',
      'fullName',
      'username',
      'avatar',
      'birthDate',
      'lastActive',
      'isInvited',
      'deletedAt',
      'createdAt',
      'updatedAt',
    ],
    subtasks: [
      'statusCount',
      'priorityCount',
      'assignedCount',
      'markdownDescription',
      'subtaskCount',
      'taskPath',
      'clickupUserEmail',
      'clickupParentId',
      'id',
      'name',
      'description',
      'estimation',
      'order',
      'priority',
      'startDate',
      'dueDate',
      'parentId',
      'statusId',
      'fileId',
      'ownerId',
      'assigned_to',
      'dependencies',
      'deletedAt',
      'createdAt',
      'updatedAt',
      'importId',
      'clickupId',
    ],
    category: ['id', 'name', 'color', 'order', 'deletedAt', 'createdAt', 'updatedAt'],
    tags: ['id', 'name', 'color', 'deletedAt', 'createdAt', 'updatedAt'],
    file: ['id', 'name', 'size', 'type', 'url', 'deletedAt', 'createdAt', 'updatedAt'],
    timers: ['id', 'start', 'end', 'duration', 'deletedAt', 'createdAt', 'updatedAt'],
    attachments: ['id', 'name', 'size', 'type', 'url', 'deletedAt', 'createdAt', 'updatedAt'],
    comments: ['id', 'text', 'deletedAt', 'createdAt', 'updatedAt'],
    notifications: ['id', 'type', 'deletedAt', 'createdAt', 'updatedAt'],
    customFieldsValues: ['id', 'value', 'deletedAt', 'createdAt', 'updatedAt'],
  };

  return columnMap[entityName] || ['id'];
} 