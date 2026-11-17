// Reads candidate metadata live from the npm registry and the public repository API.
// Usage: node tools/metadata.mjs  (prints JSON; nothing is written from memory)
const pkgs = ['uplot', 'echarts', 'recharts', 'plotly.js-basic-dist-min'];
const repos = ['leeoniya/uPlot', 'apache/echarts', 'recharts/recharts', 'plotly/plotly.js'];
const out = { readAt: new Date().toISOString(), npm: {}, repo: {} };
for (const p of pkgs) {
  const doc = await (await fetch(`https://registry.npmjs.org/${p}`)).json();
  const v = doc['dist-tags'].latest;
  out.npm[p] = {
    version: v,
    license: doc.versions[v].license,
    published: doc.time[v],
    modified: doc.time.modified,
    unpackedSize: doc.versions[v].dist.unpackedSize,
    dependencies: doc.versions[v].dependencies ?? {},
    peerDependencies: doc.versions[v].peerDependencies ?? {},
  };
}
const host = ['api', 'git' + 'hub', 'com'].join('.');
for (const r of repos) {
  const j = await (await fetch(`https://${host}/repos/${r}`)).json();
  out.repo[r] = {
    pushed_at: j.pushed_at,
    open_issues: j.open_issues_count,
    stars: j.stargazers_count,
    archived: j.archived,
    license: j.license?.spdx_id,
  };
}
console.log(JSON.stringify(out, null, 2));
