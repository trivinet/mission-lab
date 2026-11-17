{"date":"2026-11-17T13:26:24.462Z","os":"Windows_NT 10.0.26200 x64","cpu":"Intel(R) Core(TM) i7-10875H CPU @ 2.30GHz","logicalCpus":16,"totalMemGB":31.8,"freeMemGBAtStart":19.9,"node":"v24.22.2","chromium":"156.0.8078.4","note":"headless, default flags, software WebGL; developer PC in normal use, not quiesced"}
repetitions: 3, timeout per run: 240000 ms


### single, small

| Library | First render ms | Cursor call ms | Cursor to next frame ms | JS heap MB |
|---|---|---|---|---|
| uPlot | 35 (34-47) | 0.0 (0.0-0.1) | 16.7 (16.7-16.7) | 0.3 (0.3-0.3) |
| ECharts (cursor: setOption graphic) | 113 (111-117) | 6.4 (6.4-6.5) | 16.6 (16.5-16.8) | 1.4 (1.4-1.4) |
| ECharts (cursor: zrender line) | 101 (97-107) | 0.1 (0.1-0.1) | 16.7 (16.7-16.8) | 1.2 (1.2-1.2) |
| Plotly basic | 117 (117-133) | 15.5 (14.9-16.2) | 18.2 (17.2-18.8) | 1.2 (1.2-1.2) |
| Recharts | 134 (134-134) | 11.4 (10.2-11.6) | 16.6 (16.5-16.7) | 2.5 (2.5-2.5) |

### panel, small

| Library | First render ms | Cursor call ms | Cursor to next frame ms | JS heap MB |
|---|---|---|---|---|
| uPlot | 67 (66-68) | 0.1 (0.0-0.1) | 16.7 (16.4-16.8) | 0.7 (0.7-0.7) |
| ECharts (cursor: setOption graphic) | 250 (249-251) | 30.7 (30.6-30.8) | 38.3 (38.1-38.5) | 3.6 (3.6-3.6) |
| Plotly basic | 267 (267-268) | 101.6 (101.0-101.7) | 106.7 (106.5-106.9) | 2.9 (2.9-2.9) |
| Recharts | 384 (352-385) | 69.9 (69.7-70.9) | 71.9 (71.7-72.8) | 10.1 (10.1-10.1) |

Object.is read-back mismatching charts (single mode, where run):
uplot small: 0
echarts small: 0
echarts?cursor=zr small: 0
plotly small: 0
recharts small: 0
