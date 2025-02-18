import { Between, In, IsNull, LessThan, LessThanOrEqual, Like, MoreThan, MoreThanOrEqual, Not } from 'typeorm';
import { QueryBuilder } from '../index';
import { DataSource } from 'typeorm';

describe('QueryBuilder test', () => {
  let qb: QueryBuilder;
  const options = {
    LOOKUP_DELIMITER: '|',
    RELATION_DELIMITER: '.',
    CONDITION_DELIMITER: ',',
    VALUE_DELIMITER: ';',
    EXACT: 'eq',
    NOT: '!',
    CONTAINS: 'cont',
    IS_NULL: 'isnull',
    GT: 'gt',
    GTE: 'gte',
    LT: 'lt',
    LTE: 'lte',
    STARTS_WITH: 'starts',
    ENDS_WITH: 'ends',
    IN: 'in',
    BETWEEN: 'between',
    OR: 'or',
    DEFAULT_LIMIT: '25',
    GROUP_START: '(',
    GROUP_END: ')',
    AND: '$and',
    NESTED_DELIMITER: '#',
  };
  beforeEach(() => {
    qb = new QueryBuilder();
  });

  describe('basic cases', () => {
    it('No query params should return empty object', () => {
      expect(qb.build({})).toEqual({});
    });

    it('Unknown query param should return empty object', () => {
      expect(qb.build({ unknown: 'anything' } as any)).toEqual({});
    });
  });

  describe('Testing output of query params', () => {
    describe('Select query param', () => {
      it('Testing if .build() returns correct output for basic input', () => {
        expect(qb.build({ select: `name,id` })).toEqual({ select: ['name', 'id'] });
      });
      it('If no string to select is provided it should return empty object', () => {
        expect(qb.build({ select: '' })).toEqual({});
      });
    });

    describe('Sort query param', () => {
      it('should return empty object if sort string not provided', () => {
        expect(qb.build({ sort: '' })).toEqual({});
      });
      it('Testring if it works for one input', () => {
        expect(qb.build({ sort: 'name,ASC' })).toEqual({ order: { name: 'ASC' } });
      });
      it('Testring if it works for two inputs', () => {
        expect(qb.build({ sort: 'name,ASC;id,DESC' })).toEqual({ order: { name: 'ASC', id: 'DESC' } });
      });
      it('Should work with mixed case letters', () => {
        expect(qb.build({ sort: 'name,AsC;id,desC' })).toEqual({ order: { name: 'ASC', id: 'DESC' } });
      });
      it('Order should default to ASC if otherwise is not provided', () => {
        expect(qb.build({ sort: 'name' })).toEqual({ order: { name: 'ASC' } });
      });
      it('Not having value for one field should not break it for others', () => {
        expect(qb.build({ sort: 'name;id,DESC' })).toEqual({ order: { name: 'ASC', id: 'DESC' } });
      });
    });

    describe('Cache query param', () => {
      it('should return empty object if cache string not provided', () => {
        expect(qb.build({ cache: '' })).toEqual({});
      });
      it('should object with cache true', () => {
        expect(qb.build({ cache: 'true' })).toEqual({ cache: true });
      });
      it('should return object with cache false', () => {
        expect(qb.build({ cache: 'false' })).toEqual({ cache: false });
      });
      it('should work with uppercase(TRUE)', () => {
        expect(qb.build({ cache: 'TRUE' })).toEqual({ cache: true });
      });
      it('should work with uppercase(FALSE)', () => {
        expect(qb.build({ cache: 'FALSE' })).toEqual({ cache: false });
      });
    });

    describe('Limit query param', () => {
      it('should return empty object if limit string not provided', () => {
        expect(qb.build({ limit: '' })).toEqual({});
      });
      it('Should set take to specified number', () => {
        expect(qb.build({ limit: '10' })).toEqual({ take: 10 });
      });
      // it('Should throw error if string is passed',()=>{
      //   expect(qb.build({limit:'asd'})).toThrow();
      // });
    });

    describe('Page query param', () => {
      it('should return empty object if page string not provided', () => {
        expect(qb.build({ page: '' })).toEqual({});
      });
      it('Should return correct output for basic input', () => {
        expect(qb.build({ page: '2', limit: '10' })).toEqual({ skip: 10, take: 10 });
      });
      it('If limit is not provided along with page, default is 25', () => {
        expect(qb.build({ page: '2' })).toEqual({ skip: 25, take: 25 });
      });
    });

    describe('Filter query param testing', () => {
      it('should return empty object if filter string not provided', () => {
        expect(qb.build({ filter: '' })).toEqual({});
      });
      it('testing Equal', () => {
        expect(qb.build({ filter: 'name||$eq||mlad' })).toEqual({ where: [{ name: 'mlad' }] });
      });
      it('testing perfix Not', () => {
        expect(qb.build({ filter: 'name||!$eq||mlad' })).toEqual({ where: [{ name: Not('mlad') }] });
      });
      it('testing Contains', () => {
        expect(qb.build({ filter: 'name||$cont||mlad' })).toEqual({ where: [{ name: Like('%mlad%') }] });
      });
      it('testing Starts with', () => {
        expect(qb.build({ filter: 'name||$starts||mlad' })).toEqual({ where: [{ name: Like('mlad%') }] });
      });
      it('testing Ends with', () => {
        expect(qb.build({ filter: 'name||$ends||mlad' })).toEqual({ where: [{ name: Like('%mlad') }] });
      });
      it('testing is null', () => {
        expect(qb.build({ filter: 'name||$isnull||' })).toEqual({ where: [{ name: IsNull() }] });
      });
      it('testing greater than', () => {
        expect(qb.build({ filter: 'name||$gt||10' })).toEqual({ where: [{ name: MoreThan(10) }] });
      });
      it('testing less than', () => {
        expect(qb.build({ filter: 'name||$lt||10' })).toEqual({ where: [{ name: LessThan(10) }] });
      });
      it('testing gte', () => {
        expect(qb.build({ filter: 'name||$gte||10' })).toEqual({ where: [{ name: MoreThanOrEqual(10) }] });
      });
      it('testing lte', () => {
        expect(qb.build({ filter: 'name||$lte||10' })).toEqual({ where: [{ name: LessThanOrEqual(10) }] });
      });
      it('testing in operator', () => {
        expect(qb.build({ filter: 'id||$in||1,2,3' })).toEqual({ where: [{ id: In(['1', '2', '3']) }] });
      });
      it('testing between operator', () => {
        expect(qb.build({ filter: 'id||$between||1,3' })).toEqual({ where: [{ id: Between(1, 3) }] });
      });
      it('testing gte operator with date', () => {
        expect(qb.build({ filter: 'date||$gte||2021-01-01' })).toEqual({ where: [{ date: MoreThanOrEqual('2021-01-01') }] });
      });      
    });
    describe('testing join', () => {
      it('should return empty object if join string not provided', () => {
        expect(qb.build({ join: '' })).toEqual({});
      });
      it('testing basic input', () => {
        expect(qb.build({ join: 'name,id' })).toEqual({ relations: ['name', 'id'] });
      });
      it('testing nested input', () => {
        expect(qb.build({ join: 'user.name,id' })).toEqual({ relations: ['user.name', 'id'] });
      });
    });
    describe('Testing options passing', () => {
      it('should be able to set options', () => {
        const qb = new QueryBuilder(options);
        expect(qb.getOptions()).toEqual(options);
      });
      it('should be able to set single option', () => {
        const option = { ...options, DEFAULT_LIMIT: '10' };
        const qb = new QueryBuilder(option);
        expect(qb.getOptions().DEFAULT_LIMIT).toEqual('10');
      });
    });
  });

  describe('Advanced filtering tests', () => {
    it('should handle nested field filtering', () => {
      expect(qb.build({ 
        filter: 'user#name||$eq||John' 
      })).toEqual({ 
        where: [{ user: { name: 'John' } }] 
      });
    });

    it('should handle grouped conditions with AND', () => {
      expect(qb.build({ 
        filter: '(name||$eq||John;age||$gt||25)' 
      })).toEqual({ 
        where: [{ 
          name: 'John',
          age: MoreThan(25) 
        }] 
      });
    });

    it('should handle grouped conditions with OR', () => {
      expect(qb.build({ 
        filter: 'name||$eq||John||$or||age||$gt||25' 
      })).toEqual({ 
        where: [
          { name: 'John' },
          { age: MoreThan(25) }
        ] 
      });
    });

    it('should handle nested groups', () => {
      expect(qb.build({ 
        filter: '(name||$eq||John;(age||$gt||25||$or||age||$lt||20))' 
      })).toEqual({ 
        where: [{ 
          name: 'John',
          age: [MoreThan(25), LessThan(20)]
        }] 
      });
    });

    it('should handle complex nested relations', () => {
      expect(qb.build({ 
        filter: 'user#profile#address#city||$eq||NewYork;user#age||$gt||25' 
      })).toEqual({ 
        where: [{ 
          user: { 
            profile: { 
              address: { 
                city: 'NewYork' 
              } 
            },
            age: MoreThan(25)
          } 
        }] 
      });
    });

    it('should handle NOT operator with groups', () => {
      expect(qb.build({ 
        filter: '!(name||$eq||John;age||$gt||25)' 
      })).toEqual({ 
        where: [{ 
          name: Not('John'),
          age: Not(MoreThan(25))
        }] 
      });
    });
  });
});

describe('Advanced Query Builder Tests', () => {
  let qb: QueryBuilder;
  let connection: DataSource;

  beforeAll(async () => {
    qb = new QueryBuilder();
    connection = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [],
    });
    await connection.initialize();
  });

  afterAll(async () => {
    if (connection && connection.isInitialized) {
      await connection.destroy();
    }
  });

  describe('Order By with NULLS FIRST/LAST', () => {
    it('should handle NULLS FIRST in order by', () => {
      const query = {
        sort: 'name,ASC',
        orderNulls: 'name,ASC,NULLS_FIRST'
      };
      const result = qb.buildAdvanced(query, 'user', connection);
      const sql = result.getQuery();
      expect(sql).toContain('FROM "user" "user"');
      expect(sql).toContain('ORDER BY user.name ASC NULLS FIRST');
    });

    it('should handle NULLS LAST in order by', () => {
      const query = {
        sort: 'age,DESC',
        orderNulls: 'age,DESC,NULLS_LAST'
      };
      const result = qb.buildAdvanced(query, 'user', connection);
      const sql = result.getQuery();
      expect(sql).toContain('FROM "user" "user"');
      expect(sql).toContain('ORDER BY user.age DESC NULLS LAST');
    });
  });

  describe('Advanced Joins', () => {
    it('should handle LEFT JOIN with condition', () => {
      const query = {
        join: 'profile',
        joinType: 'LEFT',
        joinCondition: 'profile.userId=user.id'
      };
      const result = qb.buildAdvanced(query, 'user', connection);
      const sql = result.getQuery();
      expect(sql).toContain('FROM "user" "user"');
      expect(sql).toContain('LEFT JOIN "profile" "profile" ON profile.userId=user.id');
    });

    it('should handle INNER JOIN with condition', () => {
      const query = {
        join: 'orders',
        joinType: 'INNER',
        joinCondition: 'orders.userId=user.id'
      };
      const result = qb.buildAdvanced(query, 'user', connection);
      const sql = result.getQuery();
      expect(sql).toContain('FROM "user" "user"');
      expect(sql).toContain('INNER JOIN "orders" "orders" ON orders.userId=user.id');
    });

    it('should default to LEFT JOIN when no join type is specified', () => {
      const query = {
        join: 'orders',
        joinCondition: 'orders.userId=user.id'
      };
      const result = qb.buildAdvanced(query, 'user', connection);
      const sql = result.getQuery();
      expect(sql).toContain('FROM "user" "user"');
      expect(sql).toContain('LEFT JOIN "orders" "orders" ON orders.userId=user.id');
    });
  });

  describe('Group By with Having', () => {
    it('should handle GROUP BY with HAVING clause', () => {
      const query = {
        groupBy: 'status',
        having: 'COUNT(*) > 5'
      };
      const result = qb.buildAdvanced(query, 'order', connection);
      const sql = result.getQuery();
      expect(sql).toContain('FROM "order" "order"');
      expect(sql).toContain('GROUP BY order.status');
      expect(sql).toContain('HAVING COUNT(*) > 5');
    });

    it('should handle multiple GROUP BY fields', () => {
      const query = {
        groupBy: 'status,date',
        having: 'COUNT(*) > 5 AND SUM(total) > 1000'
      };
      const result = qb.buildAdvanced(query, 'order', connection);
      const sql = result.getQuery();
      expect(sql).toContain('FROM "order" "order"');
      expect(sql).toContain('GROUP BY order.status, order.date');
      expect(sql).toContain('HAVING COUNT(*) > 5 AND SUM(total) > 1000');
    });
  });

  describe('Complex Where Conditions', () => {
    it('should handle nested conditions with parentheses', () => {
      const query = {
        filter: '(status||$eq||active;(age||$gt||25||$or||age||$lt||20))'
      };
      const result = qb.buildAdvanced(query, 'user', connection);
      const sql = result.getQuery();
      expect(sql).toContain('FROM "user" "user"');
      expect(sql).toMatch(/status\s*=\s*:param_[a-z0-9]+/);
      expect(sql).toMatch(/age\s*>\s*:param_[a-z0-9]+/);
      expect(sql).toMatch(/age\s*<\s*:param_[a-z0-9]+/);
      expect(sql).toContain('AND');
      expect(sql).toContain('OR');
    });

    it('should handle IS NULL with NULLS FIRST ordering', () => {
      const query = {
        filter: 'deletedAt||$isnull||',
        sort: 'name,ASC',
        orderNulls: 'name,ASC,NULLS_FIRST'
      };
      const result = qb.buildAdvanced(query, 'user', connection);
      const sql = result.getQuery();
      expect(sql).toContain('FROM "user" "user"');
      expect(sql).toContain('deletedAt IS NULL');
      expect(sql).toContain('ORDER BY user.name ASC NULLS FIRST');
    });
  });

  describe('Pagination and Cache', () => {
    it('should handle pagination with custom limit', () => {
      const query = {
        page: '2',
        limit: '15'
      };
      const result = qb.buildAdvanced(query, 'user', connection);
      const sql = result.getQuery();
      expect(sql).toContain('FROM "user" "user"');
      expect(sql).toContain('LIMIT 15');
      expect(sql).toContain('OFFSET 15');
    });

    it('should handle cache option', () => {
      const query = {
        cache: 'true'
      };
      const result = qb.buildAdvanced(query, 'user', connection);
      expect(result.expressionMap.cache).toBe(true);
      expect(result.expressionMap.cacheDuration).toBe(60000);
    });
  });

  describe('Combined Advanced Features', () => {
    it('should handle complex query with multiple features', () => {
      const query = {
        select: 'id,name,email,status',
        join: 'profile,orders,orderItems',
        joinType: 'LEFT,INNER,LEFT',
        joinCondition: 'profile.userId=user.id,orders.userId=user.id,orderItems.orderId=orders.id',
        filter: '(status||$eq||active;orders#total||$gt||1000)||$or||(profile#verified||$eq||true;orderItems#quantity||$gt||5)',
        sort: 'name,ASC;orders.total,DESC',
        orderNulls: 'name,ASC,NULLS_LAST;orders.total,DESC,NULLS_LAST',
        groupBy: 'status,orders.total',
        having: 'COUNT(DISTINCT orders.id) > 2 AND SUM(orders.total) > 5000',
        page: '2',
        limit: '20',
        cache: 'true'
      };

      const result = qb.buildAdvanced(query, 'user', connection);
      const sql = result.getQuery();

      // Verify base query and select
      expect(sql).toContain('SELECT user.id, user.name, user.email, user.status');
      expect(sql).toContain('FROM "user" "user"');

      // Verify joins
      expect(sql).toContain('LEFT JOIN "profile" "profile" ON profile.userId=user.id');
      expect(sql).toContain('INNER JOIN "orders" "orders" ON orders.userId=user.id');
      expect(sql).toContain('LEFT JOIN "orderItems" "orderItems" ON orderItems.orderId=orders.id');

      // Verify complex where conditions
      expect(sql).toMatch(/\(user\.status\s*=\s*:param_[a-z0-9]+\s*AND\s*user\.orders#total\s*>\s*:param_[a-z0-9]+\)\s*OR\s*\(user\.\(profile#verified\s*=\s*:param_[a-z0-9]+\s*AND\s*user\.orderItems#quantity\s*>\s*:param_[a-z0-9]+\)/);

      // Verify order by with nulls
      expect(sql).toContain('ORDER BY user.name ASC NULLS LAST ASC, user.orders.total DESC NULLS LAST ASC');

      // Verify group by and having
      expect(sql).toContain('GROUP BY user.status, user.orders.total');
      expect(sql).toContain('HAVING COUNT(DISTINCT orders.id) > 2 AND SUM(orders.total) > 5000');

      // Verify pagination
      expect(result.expressionMap.take).toBe(20);
      expect(result.expressionMap.skip).toBe(20);

      // Verify cache
      expect(result.expressionMap.cache).toBe(true);
      expect(result.expressionMap.cacheDuration).toBe(60000);
    });
  });
});