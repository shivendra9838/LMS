import test from 'node:test';
import assert from 'node:assert/strict';
import {URLSearchParams} from 'node:url';
import {changePortfolioQuery} from '../src/utils/portfolioQuery.js';
test('clear search followed immediately by sort cannot resurrect a stale search term',()=>{
 const ref={current:new URLSearchParams('search=old-mobile&filter=ACTIVE&page=2')};
 changePortfolioQuery(ref,'search','');
 const sorted=changePortfolioQuery(ref,'sort','CODE');
 assert.equal(sorted.has('search'),false);assert.equal(sorted.get('sort'),'CODE');assert.equal(sorted.get('filter'),'ACTIVE');assert.equal(sorted.get('page'),'1');
});
test('debounced search uses the latest filter and subsequent pagination preserves both',()=>{
 const ref={current:new URLSearchParams('sort=NAME_ASC')};
 changePortfolioQuery(ref,'filter','INACTIVE');changePortfolioQuery(ref,'search','A&B');
 const page=changePortfolioQuery(ref,'page','2');assert.equal(page.get('filter'),'INACTIVE');assert.equal(page.get('search'),'A&B');assert.equal(page.get('sort'),'NAME_ASC');assert.equal(page.get('page'),'2');
});
