# Mission Lab user guide

**Release:** M1 "Orbital Sandbox" (v1.0.0, release notes in draft) · **Audience:** someone who has
not used Mission Lab before and is not an orbital mechanics expert.

Every statement here was checked against the application source or the approved requirements. A
statement that could not be checked is marked **(not confirmed)**.

## 1. What Mission Lab is, and what it is not

Mission Lab is a browser application for exploring how a spacecraft moves around the Earth. You
describe an orbit, run a simulation, optionally apply one engine burn (a "maneuver"), and look at
the result in 3D, in plots and in a comparison table.

**Mission Lab is not qualified for operational use.** It is an educational and exploratory tool.
Do not use its results for real spacecraft navigation, mission planning or operations. The
application says this itself in the model panel (wording approved by the owner, gate G2).

What it does in this release (M1):

- one spacecraft around the Earth;
- point-mass two-body motion only (see section 11 for what that leaves out);
- zero or one instantaneous velocity change (an "impulsive maneuver");
- closed orbits as the starting orbit (eccentricity from 0 up to, but not including, 1).

What it does not do in M1: Earth oblateness (J2), air drag, the Moon, the Sun, solar radiation
pressure, several maneuvers, long burns, fuel or mass, ground tracks, other reference frames,
real satellites (TLE/SGP4), comparing different scenarios with each other, accounts or cloud
storage, a phone layout. Source: `docs/requirements/m1-requirements.md` section 1.

Everything runs in your browser. No scenario leaves your computer unless you save a file yourself.

## 2. Starting the application

For now the application is started from the repository:

```
pnpm --filter @mission-lab/web dev
```

The command is from `apps/web/package.json` (script `dev`) and from the owner walkthrough step in
`docs/releases/G2-review.md`. The address and port are printed by the development server; the
repository does not fix them. Setup of the tools is in the
[developer guide](developer-guide.md). Whether a hosted copy exists is **not confirmed**: the
hosting decision is a later task (ML-TASK-042, `docs/backlog/backlog.md`).

The only browser the application was tested in is Chromium (Chrome, Edge and similar).
Other browsers were not tested.

## 3. The workspace

The window has a top bar, an editing column, a middle column with the 3D view, the timeline and
the plots, and a results column.

**Top bar**

| Control | What it does |
|---|---|
| Scenario name | Shows the name of the scenario. |
| "Unsaved changes" / "No unsaved changes" | Tells you whether the scenario differs from the last saved or loaded one. |
| Result chip | Shows the state of the result (section 7). |
| New scenario | Replaces the scenario with a default one. Asks first if you have unsaved changes. |
| Load… | Opens a scenario file (section 9). |
| Save | Downloads the scenario as a `.scenario.json` file. |
| Presets | Opens a menu of three example scenarios (section 10). |
| Export CSV | Downloads the current result as a CSV file (section 10). Disabled until a result is current. |
| Run simulation | Computes the result. |

If something in the scenario is invalid, the top bar says how many problems prevent the run, and
each problem is shown next to its field.

A new scenario starts with a runnable default: epoch 2026-01-01T00:00:00.000Z (UTC), semi-major
axis 7000 km, eccentricity 0.01, inclination 45 degrees, other angles 0, no maneuver, duration
6000 s, output step 60 s (`apps/web/src/state/default-scenario.ts`). These are product defaults,
not reference values.

## 4. Editing the orbit

The orbit is described by six numbers, the classical orbital elements. Each field shows its unit.

| Element | Meaning | Unit shown |
|---|---|---|
| a, semi-major axis | Size of the orbit | km |
| e, eccentricity | Shape: 0 is a circle, close to 1 is a long thin ellipse | none |
| i, inclination | Tilt of the orbit plane against the equator of the reference frame | degrees |
| Ω (RAAN) | Where the orbit crosses the equatorial plane going north | degrees |
| ω, argument of periapsis | Where the closest point of the orbit lies within the plane | degrees |
| ν, true anomaly | Where the spacecraft is on the orbit at the start | degrees |

You can also edit the scenario name, the epoch (a UTC date and time), the duration and the output
step, both in seconds. The output step is the time between stored samples.

Angles you type outside 0 to 360 degrees are wrapped into that range when you leave the field.

**What is rejected.** Each of these shows a message at the field and prevents the run:
a value that is not a finite number; a ≤ 0; e below 0 or 1 and above; inclination outside 0 to
180 degrees; a perigee (closest point) that is not above the Earth reference radius.

**Derived values.** Below the inputs, a separate panel shows values the engine computes from your
inputs: perigee and apogee radius and altitude, period and specific energy. They are marked as
computed. You cannot edit them. If the inputs are invalid they are withheld, with a reason.

**Circular and equatorial orbits.** For a perfectly circular orbit the "closest point" is not
defined, and for an equatorial orbit the "ascending node" is not defined. Mission Lab detects
these cases and tells you in the panel which elements are undefined and what convention it uses
instead (ADR-008):

- circular: ω is reported as 0 and ν is then the argument of latitude (measured from the ascending
  node);
- equatorial: Ω is reported as 0 and ω is then the longitude of perigee;
- both: Ω and ω are reported as 0 and ν is the true longitude.

This only changes how angles are reported. e and i are reported as computed.

**Altitude** means height above a reference sphere, not above the real shape of the Earth. It is
not geodetic altitude.

## 5. A maneuver in RSW

A maneuver is an instantaneous change of velocity (delta-v) at one moment. Click "Add maneuver",
then enter:

- the time since the epoch, in seconds (the matching UTC time is shown next to it);
- the three delta-v components in metres per second.

The time must be inside the scenario duration. Only one maneuver is allowed in this release; a
second one is rejected with a message saying so. "Remove maneuver 1" removes it. After a run the
panel shows the total delta-v magnitude, computed by the engine.

### What RSW means

The three components are given in a frame that moves with the spacecraft, called RSW. It is built
from the spacecraft state just before the burn:

- **R (radial):** pointing from the centre of the Earth to the spacecraft. A positive R burn
  pushes the spacecraft away from the Earth along that line.
- **W (cross-track):** pointing along the orbit normal, the direction perpendicular to the orbit
  plane. A W burn tilts the orbit plane.
- **S (along-track):** completes the right-handed set. It lies in the orbit plane and is
  perpendicular to R.

**Along-track note.** S is perpendicular to the radius vector. On a circular orbit that is exactly
the direction of motion, so a positive S burn speeds you up. On an orbit that is not circular, S
is **not** in general the direction of motion, because the velocity of an elliptical orbit is
tilted against the perpendicular to the radius, except where the two coincide. "Along-track" in
RSW therefore does not always mean "prograde". The workspace repeats this note under the
maneuver fields (ML-FR-005 AC3; `docs/product/ML-SYS-001.md` section 5.4).

## 6. Running

Click "Run simulation". The computation runs in a background worker, so the page stays
usable. The result chip changes to "Computing…", then to "Result current".

- The orbit is propagated from the epoch for the duration, with samples every output step, at
  the maneuver time and at the end time.
- With a maneuver, the application runs two cases over the same span: a coast run (the same orbit
  without the maneuver) and the maneuvered run.
- If you press Run again while a run is still going, the latest run wins and the earlier result
  is discarded.
- If a maneuver sends the spacecraft on an escape path, or into the Earth reference sphere
  within the simulated span, the run still completes. A warning appears in the diagnostics panel
  (ML-FR-006 AC6).

## 7. Result states

The chip in the top bar and a banner above the results tell you how far to trust what you see.

| State | Meaning |
|---|---|
| No result | Nothing has been run yet. |
| Computing… | A run is in progress. |
| Result current | The shown result belongs to the current inputs. |
| Result stale | You changed an input after the run. The values shown are from the previous run and are shown in italics. Run again to update. |
| Run failed | The engine reported a failure. The diagnostics panel gives the reason. |

Changing the scenario name does not make a result stale. Changing a physical value does. The
application never recomputes by itself.

## 8. The 3D view, playback, plots and comparison

**3D view.** It shows the Earth, the trajectory, a small marker for the spacecraft and a larger
marker at the maneuver point. Drag, or use the arrow keys, to turn the view, plus and minus to
zoom, Home or the "Reset camera" button to reset. The option "Inertial axes" shows the X, Y and Z
axes of the inertial frame. The Earth orientation drawn is labelled **illustrative**: it is for
looks only and does not affect any number. Changing a display option never starts a run.

If your browser has no WebGL the 3D view is replaced by a notice; the text summary below it still
shows the result.

**Timeline.** Buttons: Jump to start, Play/Pause, Next maneuver, Jump to end. A Rate menu chooses
1, 10, 60, 300 or 1000 simulated seconds per real second, and a slider scrubs through time. The
read-out gives the elapsed time and the UTC time. Between engine samples the marker position is
interpolated for display only, and the panel says whether the shown point is an engine sample or
interpolated. Playback never starts a simulation and never moves the marker across a maneuver
jump.

**Plots.** Tick the quantities you want. The default selection is altitude, speed and true
anomaly. Available quantities: radius, altitude, speed, true anomaly, semi-major axis,
eccentricity, inclination, RAAN, argument of periapsis, specific orbital energy, periapsis
radius, apoapsis radius, orbital period. A vertical line marks the maneuver time and another
follows the playback time. With a maneuver the coast run is dashed grey and the maneuvered run is
solid teal. Each plot has a text line that gives the values at the playback time.

In plain two-body motion the orbital elements do not change between maneuvers, so their curves
are flat. A small wiggle is numerical error, not physics. Angle curves break where they wrap past
360 degrees.

Flight-path angle and mean anomaly are not plotted. This was an owner decision at gate G3.

**Comparison table.** With a maneuver, a table lists before, after and difference (after minus
before) for the semi-major axis, eccentricity, inclination, RAAN, argument of periapsis, periapsis
and apoapsis radius, period and specific energy, plus the applied delta-v in RSW, its magnitude
and its inertial components. A value that cannot be defined (for example the period of an open
orbit) shows "n/a" with the reason. Differences at the level of numerical round-off are shown as
zero; the exact value is in the cell tooltip and can be copied.

## 9. Saving and loading

**Save** downloads a file named like `<scenario name>.scenario.json`. The file holds a
`schemaVersion` and everything needed to reproduce the run. Saving, loading and saving again
gives an identical file, and running a loaded scenario reproduces the original result.
You cannot save a scenario that the engine rejects; the dialog says why.

**Load…** opens a file. A file is rejected with a readable message, and the current scenario is
left unchanged, if it is invalid JSON, has an unknown or missing schema version, breaks the
schema, has out-of-range values, or is larger than 64 KiB. If you have unsaved changes the
application asks before replacing them. "New scenario" and the presets ask in the same way.

"No unsaved changes" / "Unsaved changes" in the top bar shows whether you need to save.

## 10. Presets and CSV export

**Presets** are three example scenarios. They load through the same validation as a file you
choose. They are product choices to show different behaviour, not references to real missions
(`apps/web/src/presets/presets.ts`):

| Preset | What it shows |
|---|---|
| Near-circular LEO | a = 6900 km, e = 0.001, i = 50 deg, no maneuver, 6000 s |
| Eccentric inclined orbit, along-track burn | a = 24000 km, e = 0.6, i = 60 deg, +300 m/s along-track at t = 18000 s, 40000 s |
| Escape burn from LEO | a = 6800 km, e = 0.001, i = 30 deg, +3500 m/s along-track at t = 600 s, 12000 s |

**Export CSV** downloads the current result: a header of lines starting with `#` (frame, epoch,
units, request id, model), then one row per sample with the columns
`segment,t_s,x_m,y_m,z_m,vx_mps,vy_mps,vz_mps`. Values are in SI units, not converted. The
maneuver instant appears twice, once with the velocity before and once after the burn.

## 11. The model panel and the limits

The model panel lists, for the current result: dynamics model, central body, gravitational
parameter, reference radius and the source of these constants, propagator, maneuver model, frame,
epoch, time convention, engine version, duration, output step, and a list of limitations. All of
it is read from the result, not typed into the interface. The panel also carries the
not-qualified statement.

Limits you should know:

- **Two-body only.** Point-mass gravity of the Earth. No J2, drag, third bodies or radiation
  pressure.
- **One frame.** GCRF only. UTC labels are epoch plus elapsed seconds, with no leap-second
  handling.
- **Sample limit.** A run may hold at most 1,000,000 samples; a scenario above that is rejected.
  Above 250,000 samples the top bar shows "Large run: playback will be slower"; the run is not
  blocked. These figures are from the owner decision of 2026-11-17 and the measured record in
  `docs/verification/performance-envelope.md`, which was made on one machine with software
  rendering.
- **Scenario file limit.** 64 KiB.
- **Browser.** Tested in Chromium only. Screen readers, other browsers and colour-blind rendering
  were not tested (G2 and G3 reviews).

## 12. Keyboard use

Every control is meant to be reachable and usable by keyboard (ML-UX-004). The keyboard tests
cover editing, adding a maneuver, running, playback controls, the plots, file controls and
dialogs, and the details in the model panel. A full keyboard review is part of ML-TASK-040, whose
result is **not confirmed** at the time of writing.

## 13. Where the numbers come from

The simulation engine is checked against independent calculations and against Orekit, an external
tool, under tolerances approved by the owner. That evidence, and its limits, is in the
[traceability matrix](verification/traceability-matrix.md) and the
[release notes](releases/release-notes-v1.0.0.md). Looking plausible is not evidence of being
correct, and the application must not be used where a wrong number could cause harm.
