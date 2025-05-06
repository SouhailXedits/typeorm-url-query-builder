import { DataSource, ObjectLiteral, Repository, EntityManager } from 'typeorm';
import { IOptionsObject, IParserQueryObject } from './interfaces';
import { QueryBuilder } from './builder';

/**
 * This class provides wrapper methods for TypeORM repositories to ensure correct Not operator handling
 * when using the QueryBuilder from URL parameters.
 * 
 * TypeORM has a known issue when using FindOptionsWhere with Not operators in Repository methods,
 * which can generate incorrect SQL with = operators instead of <> operators.
 * These wrapper methods use the QueryBuilder approach internally to generate correct SQL.
 */
export class RepositoryWrapper<Entity extends ObjectLiteral> {
  private queryBuilder: QueryBuilder;
  private alias: string;
  private repository: Repository<Entity> | EntityManager;
  private dataSource: DataSource | null = null;

  constructor(
    repository: Repository<Entity> | EntityManager, 
    alias: string, 
    options: IOptionsObject = {}, 
    dataSource?: DataSource
  ) {
    this.repository = repository;
    this.alias = alias;
    this.queryBuilder = new QueryBuilder(options);
    this.dataSource = dataSource || null;
  }

  /**
   * Find entities that match the URL query parameters
   * @param queryObject The parsed URL query parameters
   * @returns Entities that match the criteria
   */
  async find(queryObject: IParserQueryObject): Promise<Entity[]> {
    // Create a query builder from the repository
    let qb;
    if ('metadata' in this.repository) {
      // It's a Repository
      qb = this.repository.createQueryBuilder(this.alias);
    } else {
      // It's an EntityManager
      const entityManager = this.repository as EntityManager;
      qb = entityManager.createQueryBuilder<Entity>(Object as any, this.alias);
    }
    
    // Apply the advanced query builder to ensure proper SQL generation
    const enhancedQb = this.queryBuilder.buildAdvanced<Entity>(queryObject, this.alias, qb);
    
    // Execute the query and return results
    return enhancedQb.getMany();
  }

  /**
   * Find one entity that matches the URL query parameters
   * @param queryObject The parsed URL query parameters
   * @returns Entity that matches the criteria or undefined
   */
  async findOne(queryObject: IParserQueryObject): Promise<Entity | null> {
    // Create a query builder from the repository
    let qb;
    if ('metadata' in this.repository) {
      // It's a Repository
      qb = this.repository.createQueryBuilder(this.alias);
    } else {
      // It's an EntityManager
      const entityManager = this.repository as EntityManager;
      qb = entityManager.createQueryBuilder<Entity>(Object as any, this.alias);
    }
    
    // Apply the advanced query builder to ensure proper SQL generation
    const enhancedQb = this.queryBuilder.buildAdvanced<Entity>(queryObject, this.alias, qb);
    
    // Execute the query and return a single result
    return enhancedQb.getOne();
  }

  /**
   * Count entities that match the URL query parameters
   * @param queryObject The parsed URL query parameters
   * @returns Count of entities that match the criteria
   */
  async count(queryObject: IParserQueryObject): Promise<number> {
    // Create a query builder from the repository
    let qb;
    if ('metadata' in this.repository) {
      // It's a Repository
      qb = this.repository.createQueryBuilder(this.alias);
    } else {
      // It's an EntityManager
      const entityManager = this.repository as EntityManager;
      qb = entityManager.createQueryBuilder<Entity>(Object as any, this.alias);
    }
    
    // Apply the advanced query builder to ensure proper SQL generation
    const enhancedQb = this.queryBuilder.buildAdvanced<Entity>(queryObject, this.alias, qb);
    
    // Execute the count query
    return enhancedQb.getCount();
  }

  /**
   * Find entities and return with pagination info
   * @param queryObject The parsed URL query parameters
   * @returns Paginated result with entities and count
   */
  async findAndCount(queryObject: IParserQueryObject): Promise<[Entity[], number]> {
    // Create a query builder from the repository
    let qb;
    if ('metadata' in this.repository) {
      // It's a Repository
      qb = this.repository.createQueryBuilder(this.alias);
    } else {
      // It's an EntityManager
      const entityManager = this.repository as EntityManager;
      qb = entityManager.createQueryBuilder<Entity>(Object as any, this.alias);
    }
    
    // Apply the advanced query builder to ensure proper SQL generation
    const enhancedQb = this.queryBuilder.buildAdvanced<Entity>(queryObject, this.alias, qb);
    
    // Execute the query with count
    return enhancedQb.getManyAndCount();
  }

  /**
   * Handle a direct not-equals query for a specific field.
   * This uses raw SQL to ensure the NOT EQUALS operator works correctly.
   * @param field The field to check
   * @param value The value to not equal
   * @param additionalConditions Any additional WHERE conditions
   * @returns Entities matching the criteria
   */
  async findWithNotEquals(
    field: string, 
    value: any, 
    additionalConditions: string[] = []
  ): Promise<Entity[]> {
    // Get the entity metadata to determine the table name
    const metadata = (this.repository as Repository<Entity>).metadata;
    const tableName = metadata.tableName;
    const tableAlias = this.alias || tableName;
    
    // Build the base SELECT query
    let query = `SELECT ${tableAlias}.* FROM "${tableName}" "${tableAlias}"`;
    
    // Add soft delete condition if applicable
    const deletedAtColumn = metadata.columns.find((col: { propertyName: string }) => col.propertyName === 'deletedAt');
    let softDeleteCondition = '';
    if (deletedAtColumn) {
      softDeleteCondition = ` AND ( "${tableAlias}"."${deletedAtColumn.propertyName}" IS NULL )`;
    }
    
    // Create the main WHERE condition with NOT EQUALS (<>) operator
    const whereCondition = `"${tableAlias}"."${field}" <> $1`;
    
    // Combine with additional conditions
    const finalWhereClause = [whereCondition, ...additionalConditions].join(' AND ');
    
    // Complete the query
    query += ` WHERE (${finalWhereClause})${softDeleteCondition}`;
    
    // Use entityManager to execute the query with parameters
    if (this.dataSource) {
      return this.dataSource.query(query, [value]) as Promise<Entity[]>;
    } else {
      // Fallback to repository.query if dataSource not available
      return (this.repository as Repository<Entity>).query(query, [value]) as Promise<Entity[]>;
    }
  }

  /**
   * Count entities with a direct not-equals condition for a specific field.
   * This uses raw SQL to ensure the NOT EQUALS operator works correctly.
   * @param field The field to check
   * @param value The value to not equal
   * @param additionalConditions Any additional WHERE conditions
   * @returns Count of entities matching the criteria
   */
  async countWithNotEquals(
    field: string, 
    value: any, 
    additionalConditions: string[] = []
  ): Promise<number> {
    // Get the entity metadata to determine the table name
    const metadata = (this.repository as Repository<Entity>).metadata;
    const tableName = metadata.tableName;
    const tableAlias = this.alias || tableName;
    
    // Build the base COUNT query
    let query = `SELECT COUNT(*) as count FROM "${tableName}" "${tableAlias}"`;
    
    // Add soft delete condition if applicable
    const deletedAtColumn = metadata.columns.find((col: { propertyName: string }) => col.propertyName === 'deletedAt');
    let softDeleteCondition = '';
    if (deletedAtColumn) {
      softDeleteCondition = ` AND ( "${tableAlias}"."${deletedAtColumn.propertyName}" IS NULL )`;
    }
    
    // Create the main WHERE condition with NOT EQUALS (<>) operator
    const whereCondition = `"${tableAlias}"."${field}" <> $1`;
    
    // Combine with additional conditions
    const finalWhereClause = [whereCondition, ...additionalConditions].join(' AND ');
    
    // Complete the query
    query += ` WHERE (${finalWhereClause})${softDeleteCondition}`;
    
    // Use entityManager to execute the query with parameters
    let result;
    if (this.dataSource) {
      result = await this.dataSource.query(query, [value]);
    } else {
      // Fallback to repository.query if dataSource not available
      result = await (this.repository as Repository<Entity>).query(query, [value]);
    }
    
    return parseInt(result[0]?.count || '0', 10);
  }
}

/**
 * Factory function to create a repository wrapper
 */
export function createRepositoryWrapper<Entity extends ObjectLiteral>(
  repository: Repository<Entity> | EntityManager,
  alias: string,
  options: IOptionsObject = {},
  dataSource?: DataSource
): RepositoryWrapper<Entity> {
  return new RepositoryWrapper<Entity>(repository, alias, options, dataSource);
}

/**
 * A direct solution for the Not operator issue in TypeORM.
 * This function will generate and execute a raw SQL query with the correct NOT EQUALS operator,
 * bypassing TypeORM's incorrect translation of Not operations.
 */
export async function executeNotEqualsQuery<T extends ObjectLiteral>(
  repository: Repository<T>, 
  field: string, 
  value: any, 
  additionalConditions: string[] = []
): Promise<T[]> {
  // Get the entity metadata
  const metadata = repository.metadata;
  const tableName = metadata.tableName;
  const tableAlias = tableName;
  
  // Build the base SELECT query
  let query = `SELECT ${tableAlias}.* FROM "${tableName}" "${tableAlias}"`;
  
  // Add soft delete condition if applicable
  const deletedAtColumn = metadata.columns.find((col: { propertyName: string }) => col.propertyName === 'deletedAt');
  let softDeleteCondition = '';
  if (deletedAtColumn) {
    softDeleteCondition = ` AND ( "${tableAlias}"."${deletedAtColumn.propertyName}" IS NULL )`;
  }
  
  // Create the main WHERE condition with NOT EQUALS (<>) operator
  const paramName = 'notEqualsParam';
  const whereCondition = `"${tableAlias}"."${field}" <> $1`;
  
  // Combine with additional conditions
  const finalWhereClause = [whereCondition, ...additionalConditions].join(' AND ');
  
  // Complete the query
  query += ` WHERE (${finalWhereClause})${softDeleteCondition}`;
  
  // Execute the query with parameters (using array instead of object for parameters)
  return repository.query(query, [value]) as Promise<T[]>;
}

/**
 * A direct solution for counting records with Not equals condition.
 * This function will generate and execute a raw SQL count query with the correct NOT EQUALS operator,
 * bypassing TypeORM's incorrect translation of Not operations.
 */
export async function countWithNotEquals<T extends ObjectLiteral>(
  repository: Repository<T>, 
  field: string, 
  value: any, 
  additionalConditions: string[] = []
): Promise<number> {
  // Get the entity metadata
  const metadata = repository.metadata;
  const tableName = metadata.tableName;
  const tableAlias = tableName;
  
  // Build the base COUNT query
  let query = `SELECT COUNT(*) as count FROM "${tableName}" "${tableAlias}"`;
  
  // Add soft delete condition if applicable
  const deletedAtColumn = metadata.columns.find((col: { propertyName: string }) => col.propertyName === 'deletedAt');
  let softDeleteCondition = '';
  if (deletedAtColumn) {
    softDeleteCondition = ` AND ( "${tableAlias}"."${deletedAtColumn.propertyName}" IS NULL )`;
  }
  
  // Create the main WHERE condition with NOT EQUALS (<>) operator
  const paramName = 'notEqualsParam';
  const whereCondition = `"${tableAlias}"."${field}" <> $1`;
  
  // Combine with additional conditions
  const finalWhereClause = [whereCondition, ...additionalConditions].join(' AND ');
  
  // Complete the query
  query += ` WHERE (${finalWhereClause})${softDeleteCondition}`;
  
  // Execute the query with parameters (using array instead of object for parameters)
  const result = await repository.query(query, [value]);
  return parseInt(result[0]?.count || '0', 10);
} 