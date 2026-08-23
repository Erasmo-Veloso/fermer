import { describe, it, expect } from 'vitest';
import { buildSpawnPlan } from '../../src/commands/run';

const onWindows = process.platform === 'win32';

describe('command: run — spawn planning', () => {
  it('spawns a plain executable directly, never through a shell', () => {
    const plan = buildSpawnPlan('node', ['-e', "console.log('a b')"]);
    expect(plan.verbatim).toBe(false);
    expect(plan.args).toEqual(['-e', "console.log('a b')"]);
    expect(plan.file.toLowerCase()).not.toContain('cmd.exe');
  });

  it('passes arguments through untouched, including shell metacharacters', () => {
    const plan = buildSpawnPlan('node', ['x&y', 'a|b', 'c>d', 'has space']);
    expect(plan.args).toEqual(['x&y', 'a|b', 'c>d', 'has space']);
  });

  it('leaves an unresolvable command for spawn to report', () => {
    const plan = buildSpawnPlan('definitely-not-a-real-command-xyz', ['arg']);
    expect(plan.file).toBe('definitely-not-a-real-command-xyz');
    expect(plan.args).toEqual(['arg']);
    expect(plan.verbatim).toBe(false);
  });

  it.runIf(onWindows)('routes a .cmd shim through cmd.exe with escaped arguments', () => {
    const plan = buildSpawnPlan('npm', ['--version']);
    expect(plan.file.toLowerCase()).toContain('cmd');
    expect(plan.verbatim).toBe(true);
    expect(plan.args.slice(0, 3)).toEqual(['/d', '/s', '/c']);
  });

  it.runIf(onWindows)('escapes metacharacters so cmd.exe cannot run a second command', () => {
    const plan = buildSpawnPlan('npm', ['ignored&echo INJECTED']);
    const commandLine = plan.args[3];
    // The & must be ^-escaped; a bare & would terminate the first command and
    // start "echo INJECTED" as a new one.
    expect(commandLine).not.toMatch(/[^^]&/);
    expect(commandLine).toContain('^&');
  });

  it.runIf(onWindows)('resolves node to a real .exe rather than shelling out', () => {
    const plan = buildSpawnPlan('node', ['--version']);
    expect(plan.file.toLowerCase()).toMatch(/node\.exe$/);
    expect(plan.verbatim).toBe(false);
  });
});
