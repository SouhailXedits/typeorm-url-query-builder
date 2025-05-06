import {
  FindOptionsSelect,
  FindOptionsSelectByString,
  FindOptionsOrder,
  FindOptionsWhere,
  ObjectLiteral
} from 'typeorm';

export interface IOptionsObject {
  LOOKUP_DELIMITER?: string;
  RELATION_DELIMITER?: string;
  EXACT?: string;
  NOT?: string;
  CONTAINS?: string;
  IS_NULL?: string;
  GT?: string;
  GTE?: string;
  LT?: string;
  LTE?: string;
  STARTS_WITH?: string;
  ENDS_WITH?: string;
  IN?: string;
  BETWEEN?: string;
  OR?: string;
  CONDITION_DELIMITER?: string;
  VALUE_DELIMITER?: string;
  DEFAULT_LIMIT?: string;
  GROUP_START?: string;
  GROUP_END?: string;
  AND?: string;
  NESTED_DELIMITER?: string;
  NOT_EQUALS?: string;
}

export interface IQueryTypeOrm<T = any> {
  select?: FindOptionsSelect<T> | FindOptionsSelectByString<T>;
  relations?: string[];
  where?: FindOptionsWhere<T> | FindOptionsWhere<T>[];
  order?: FindOptionsOrder<T>;
  skip?: number;
  take?: number;
  cache?: boolean;
}

export interface IParserQueryObject {
  select?: string;
  join?: string;
  sort?: string;
  cache?: string;
  limit?: string;
  page?: string;
  filter?: string;
}

export interface ILooseObject {
  [key: string]: any;
  [key: number]: any;
}

export enum EDateType {
  Date = 'yyyy-MM-dd',
  Datetime = 'yyyy-MM-dd HH:MM:ss',
}

export interface IWhereGroup {
  type: 'AND' | 'OR';
  conditions: (IWhereCondition | IWhereGroup)[];
}

export interface IWhereCondition {
  field: string;
  operator: string;
  value: any;
  not?: boolean;
}

export interface IAdvancedQueryObject extends IParserQueryObject {
  orderNulls?: string; // Format: "field,ASC,NULLS_FIRST;field2,DESC,NULLS_LAST"
  groupBy?: string; // Format: "field1,field2"
  having?: string; // Format: "count > 5;sum > 1000"
  joinType?: string; // Format: "table,LEFT;table2,INNER"
  joinCondition?: string; // Format: "table.field=other.field;table2.field=other.field"
}

export interface IAdvancedOptions extends IOptionsObject {
  NULLS_FIRST?: string;
  NULLS_LAST?: string;
  HAVING_DELIMITER?: string;
  JOIN_TYPE_DELIMITER?: string;
  JOIN_CONDITION_DELIMITER?: string;
} 