/**
 * The Presets menu (ML-FR-013): a button that opens a list of example scenarios. Choosing one
 * hands the preset to `onPick`, which loads it through the same validation path as a user file.
 * Keyboard: Enter or Space opens; Arrow keys move; Enter or Space chooses; Escape closes and
 * returns focus to the button; Tab closes. Selection never runs a simulation.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { PRESETS } from './presets';
import type { Preset } from './presets';

interface Props {
  readonly onPick: (preset: Preset) => void;
}

export function PresetMenu({ onPick }: Props) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLSpanElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  const close = (refocus: boolean): void => {
    setOpen(false);
    if (refocus) {
      button.current?.focus();
    }
  };

  useEffect(() => {
    if (open) {
      items.current[0]?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent): void => {
      if (
        root.current !== null &&
        event.target instanceof Node &&
        !root.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const move = (from: number, step: number): void => {
    const next = (from + step + PRESETS.length) % PRESETS.length;
    items.current[next]?.focus();
  };

  return (
    <span className="preset-menu" ref={root}>
      <button
        type="button"
        ref={button}
        data-testid="presets-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setOpen((v) => !v);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        Presets <span aria-hidden="true">&#9662;</span>
      </button>
      {open && (
        <ul
          id={menuId}
          role="menu"
          aria-label="Example scenarios"
          className="preset-list"
          data-testid="presets-menu"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              close(true);
            } else if (event.key === 'Tab') {
              close(false);
            }
          }}
        >
          {PRESETS.map((preset, i) => (
            <li key={preset.id} role="none">
              <button
                type="button"
                role="menuitem"
                ref={(el) => {
                  items.current[i] = el;
                }}
                data-testid={`preset-${preset.id}`}
                onClick={() => {
                  close(true);
                  onPick(preset);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    move(i, 1);
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    move(i, -1);
                  } else if (event.key === 'Home') {
                    event.preventDefault();
                    move(0, 0);
                  } else if (event.key === 'End') {
                    event.preventDefault();
                    move(PRESETS.length - 1, 0);
                  }
                }}
              >
                <span className="preset-label">{preset.label}</span>
                <span className="preset-summary">{preset.summary}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
