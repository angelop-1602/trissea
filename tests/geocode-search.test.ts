import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildProviderSearchQuery,
  buildSearchCacheKey,
  buildSearchViewbox,
  dedupeSearchResults,
  formatSearchViewbox,
  parseSearchBias,
  rankSearchResults,
  sortResultsByDistance,
} from '@/lib/geocode/search';

const sampleCenter = { latitude: 17.6136, longitude: 121.7268 };

test('parseSearchBias accepts valid coordinates and rejects invalid values', () => {
  assert.deepEqual(
    parseSearchBias(new URLSearchParams({ latitude: '17.6136', longitude: '121.7268' })),
    sampleCenter
  );
  assert.equal(parseSearchBias(new URLSearchParams({ latitude: '91', longitude: '121.7268' })), null);
  assert.equal(parseSearchBias(new URLSearchParams({ latitude: '17.6136', longitude: 'bad' })), null);
  assert.equal(parseSearchBias(new URLSearchParams({ latitude: '17.6136' })), null);
});

test('buildSearchViewbox creates a bounded area around the provided point', () => {
  const viewbox = buildSearchViewbox(sampleCenter, 15);

  assert.ok(viewbox.west < sampleCenter.longitude);
  assert.ok(viewbox.east > sampleCenter.longitude);
  assert.ok(viewbox.south < sampleCenter.latitude);
  assert.ok(viewbox.north > sampleCenter.latitude);
  assert.match(formatSearchViewbox(viewbox), /^121\.\d{6},17\.\d{6},121\.\d{6},17\.\d{6}$/);
});

test('sortResultsByDistance puts nearby suggestions first', () => {
  const results = [
    { label: 'Far place', latitude: 17.98, longitude: 121.92 },
    { label: 'Near place', latitude: 17.614, longitude: 121.727 },
  ];

  assert.deepEqual(
    sortResultsByDistance(results, sampleCenter).map((result) => result.label),
    ['Near place', 'Far place']
  );
});

test('dedupeSearchResults removes invalid and duplicate suggestions', () => {
  assert.deepEqual(
    dedupeSearchResults([
      { label: ' SM Center ', latitude: 17.6136, longitude: 121.7268 },
      { label: 'SM Center', latitude: 17.6136, longitude: 121.7268 },
      { label: '', latitude: 17.6136, longitude: 121.7268 },
      { label: 'Bad', latitude: Number.NaN, longitude: 121.7268 },
    ]),
    [{ label: 'SM Center', latitude: 17.6136, longitude: 121.7268 }]
  );
});

test('buildSearchCacheKey keeps global and rounded local searches separate', () => {
  assert.equal(buildSearchCacheKey(' SM Center ', null), 'v5|sm center|global');
  assert.equal(buildSearchCacheKey('SM Center', sampleCenter), 'v5|sm center|bias=17.61,121.73');
});

test('buildProviderSearchQuery normalizes common abbreviations without local place data', () => {
  assert.equal(buildProviderSearchQuery('st.'), 'saint');
  assert.equal(buildProviderSearchQuery('St. Paul'), 'saint paul');
  assert.equal(buildProviderSearchQuery('cagayan h'), 'cagayan h');
});

test('rankSearchResults prefers text relevance before nearby but weak matches', () => {
  const labels = rankSearchResults(
    [
      { label: 'Cagayan-Apayao Road, Maddarulug, Solana', latitude: 17.6143743, longitude: 121.6864 },
      { label: 'Cagayan National High School, Bagay Road, Tuguegarao', latitude: 17.6189131, longitude: 121.7250549 },
      { label: 'Cagayan Museum and Historical Research Center, Tuguegarao', latitude: 17.6116508, longitude: 121.7307785 },
    ],
    'cagayan h',
    sampleCenter
  ).map((result) => result.label);

  assert.equal(labels.includes('Cagayan National High School, Bagay Road, Tuguegarao'), true);
  assert.equal(labels.includes('Cagayan-Apayao Road, Maddarulug, Solana'), false);
});
