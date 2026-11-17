{"date":"2026-11-17T13:10:00.926Z","os":"Windows_NT 10.0.26200 x64","cpu":"Intel(R) Core(TM) i7-10875H CPU @ 2.30GHz","logicalCpus":16,"totalMemGB":31.8,"freeMemGBAtStart":18.4,"node":"v24.22.2","chromium":"156.0.8078.4","note":"headless, default flags, software WebGL; developer PC in normal use, not quiesced"}
repetitions: 3, timeout per run: 240000 ms


### single, n1e4

| Library | First render ms | Cursor call ms | Cursor to next frame ms | JS heap MB |
|---|---|---|---|---|
| uPlot | 50 (48-50) | 0.1 (0.0-0.1) | 16.7 (16.6-16.8) | 0.5 (0.5-0.5) |
| ECharts (cursor: setOption graphic) | 152 (150-187) | 10.3 (10.1-10.3) | 16.8 (16.8-16.8) | 5.3 (5.3-5.3) |
| ECharts (cursor: zrender line) | 135 (134-140) | 0.1 (0.1-0.1) | 16.7 (16.5-16.8) | 5.1 (5.1-5.1) |
| Plotly basic | 143 (133-147) | 20.9 (20.8-21.0) | 24.0 (23.3-24.6) | 2.2 (2.2-2.2) |
| Recharts | 835 (825-839) | 163.0 (161.6-163.1) | 164.0 (162.6-164.3) | 28.0 (28.0-28.0) |

### single, n2_5e5

| Library | First render ms | Cursor call ms | Cursor to next frame ms | JS heap MB |
|---|---|---|---|---|
| uPlot | 92 (92-93) | 0.1 (0.0-0.1) | 16.6 (16.5-16.6) | 5.1 (5.1-5.1) |
| ECharts (cursor: setOption graphic) | 787 (781-825) | 112.6 (111.8-112.9) | 126.2 (125.0-126.3) | 98.9 (98.9-98.9) |
| ECharts (cursor: zrender line) | 741 (646-748) | 0.1 (0.1-0.1) | 16.3 (15.6-16.5) | 98.7 (98.7-98.7) |
| Plotly basic | 403 (399-406) | 168.2 (165.7-172.9) | 170.4 (167.9-175.4) | 23.5 (22.5-23.5) |
| Recharts | 17126 (17078-17152) | 4020.5 (4006.2-4028.0) | 4022.6 (4008.4-4029.7) | 632.4 (632.4-632.4) |

### panel, n1e4

| Library | First render ms | Cursor call ms | Cursor to next frame ms | JS heap MB |
|---|---|---|---|---|
| uPlot | 101 (100-123) | 0.1 (0.1-0.1) | 16.6 (16.5-16.7) | 2.1 (2.1-2.1) |
| ECharts (cursor: setOption graphic) | 586 (583-592) | 73.8 (72.3-74.8) | 210.8 (208.9-211.5) | 35.4 (35.4-35.5) |
| Plotly basic | 381 (379-400) | 139.9 (139.8-142.1) | 145.4 (145.2-146.8) | 10.1 (10.1-10.1) |
| Recharts | 5466 (5449-5483) | 1283.8 (1282.6-1288.7) | 1286.1 (1284.8-1291.0) | 213.6 (213.6-213.6) |

### panel, n2_5e5

| Library | First render ms | Cursor call ms | Cursor to next frame ms | JS heap MB |
|---|---|---|---|---|
| uPlot | 364 (347-366) | 0.1 (0.1-0.1) | 16.5 (16.5-16.6) | 35.9 (35.9-35.9) |
| ECharts (cursor: setOption graphic) | 9740 (9626-9951) | 1111.6 (1105.9-1111.7) | 6154.7 (6077.9-6463.5) | 799.8 (799.8-802.8) |
| Plotly basic | 2134 (2130-2196) | 1372.6 (1358.7-1381.6) | 1377.6 (1364.6-1386.8) | 166.5 (166.5-166.5) |
| Recharts | no result: timeout after 240000 ms on rep 1 | | | |

Object.is read-back mismatching charts (single mode, where run):
uplot n1e4: 0
echarts n1e4: 0
echarts?cursor=zr n1e4: 0
plotly n1e4: 0
recharts n1e4: 0
uplot n2_5e5: 0
echarts n2_5e5: 0
echarts?cursor=zr n2_5e5: 0
plotly n2_5e5: 0
recharts n2_5e5: 0
