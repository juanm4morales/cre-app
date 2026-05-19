import type { KeyboardEvent, ReactNode } from 'react';
import { CalendarDays } from 'lucide-react';

interface CalendarCellMeta {
  className?: string;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  ariaSelected?: boolean;
  showIcon?: boolean;
  badge?: ReactNode;
}

interface PlanningCalendarProps {
  year: number;
  month: number;
  onMonthChange: (month: number) => void;
  onSelectDate: (isoDate: string) => void;
  getCellMeta?: (isoDate: string, date: Date) => CalendarCellMeta;
  compactList?: ReactNode;
}

const DAY_HEADERS = [
  { short: 'Lun', label: 'Lunes' },
  { short: 'Mar', label: 'Martes' },
  { short: 'Mié', label: 'Miércoles' },
  { short: 'Jue', label: 'Jueves' },
  { short: 'Vie', label: 'Viernes' },
  { short: 'Sáb', label: 'Sábado' },
  { short: 'Dom', label: 'Domingo' },
];

function dateToIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildCalendarCells(year: number, month: number): Array<{ date: Date | null; iso: string | null }> {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const mondayBasedStart = (firstDay.getDay() + 6) % 7;
  const cells: Array<{ date: Date | null; iso: string | null }> = [];

  for (let i = 0; i < mondayBasedStart; i += 1) {
    cells.push({ date: null, iso: null });
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = new Date(year, month, day);
    cells.push({ date, iso: dateToIso(date) });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, iso: null });
  }

  return cells;
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function chunkRows<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

function PlanningCalendar({
  year,
  month,
  onMonthChange,
  onSelectDate,
  getCellMeta,
  compactList,
}: PlanningCalendarProps) {
  const monthLabel = new Date(year, month, 1).toLocaleString('es-AR', {
    month: 'long',
    year: 'numeric',
  });

  const todayIso = dateToIso(new Date());
  const calendarCells = buildCalendarCells(year, month).map((cell) => {
    if (!cell.iso || !cell.date) {
      return { ...cell, cellMeta: null };
    }

    return {
      ...cell,
      cellMeta: getCellMeta?.(cell.iso, cell.date) || {},
    };
  });
  const calendarRows = chunkRows(calendarCells, 7);
  const selectableIsoDates = calendarCells
    .filter((cell) => cell.iso && cell.date && !cell.cellMeta?.disabled)
    .map((cell) => cell.iso as string);

  const focusDate = (isoDate: string) => {
    document.querySelector<HTMLButtonElement>(`[data-calendar-date="${isoDate}"]`)?.focus();
  };

  const handleDayKeyDown = (event: KeyboardEvent<HTMLButtonElement>, isoDate: string) => {
    const currentIndex = selectableIsoDates.indexOf(isoDate);
    if (currentIndex === -1) return;

    const moveFocus = (nextIndex: number) => {
      const nextIsoDate = selectableIsoDates[Math.max(0, Math.min(selectableIsoDates.length - 1, nextIndex))];
      if (!nextIsoDate || nextIsoDate === isoDate) return;

      event.preventDefault();
      focusDate(nextIsoDate);
    };

    if (event.key === 'ArrowRight') moveFocus(currentIndex + 1);
    if (event.key === 'ArrowLeft') moveFocus(currentIndex - 1);
    if (event.key === 'ArrowDown') moveFocus(currentIndex + 7);
    if (event.key === 'ArrowUp') moveFocus(currentIndex - 7);
    if (event.key === 'Home') moveFocus(0);
    if (event.key === 'End') moveFocus(selectableIsoDates.length - 1);
  };

  return (
    <>
      <div className="calendar-toolbar">
        <button className="button button-ghost" type="button" onClick={() => onMonthChange(Math.max(0, month - 1))}>
          Mes anterior
        </button>
        <strong className="calendar-month-label">{monthLabel}</strong>
        <button className="button button-ghost" type="button" onClick={() => onMonthChange(Math.min(11, month + 1))}>
          Mes siguiente
        </button>
      </div>

      <div className="calendar-scroll-wrap">
        <div className="calendar-grid" role="grid" aria-label={`Calendario de ${monthLabel}`}>
          <div className="calendar-row" role="row">
            {DAY_HEADERS.map((day) => (
              <div className="calendar-head" role="columnheader" aria-label={day.label} key={day.short}>
                {day.short}
              </div>
            ))}
          </div>

          {calendarRows.map((row, rowIndex) => (
            <div className="calendar-row" role="row" key={`week-${rowIndex}`}>
              {row.map((cell, cellIndex) => {
                const isoDate = cell.iso;
                if (!isoDate || !cell.date || !cell.cellMeta) {
                  return (
                    <div
                      className="calendar-cell muted-cell"
                      role="gridcell"
                      aria-disabled="true"
                      aria-label="Sin fecha"
                      key={`empty-${rowIndex}-${cellIndex}`}
                    />
                  );
                }

                const dateLabel = formatDateLabel(cell.date);
                const accessibleLabel = cell.cellMeta.ariaLabel || `${dateLabel}. ${cell.cellMeta.title || 'Seleccionar fecha'}`;

                return (
                  <button
                    className={`calendar-cell ${cell.cellMeta.className || ''}`.trim()}
                    type="button"
                    role="gridcell"
                    key={isoDate}
                    data-calendar-date={isoDate}
                    onClick={() => onSelectDate(isoDate)}
                    onKeyDown={(event) => handleDayKeyDown(event, isoDate)}
                    title={cell.cellMeta.title || 'Seleccionar fecha'}
                    aria-label={accessibleLabel}
                    aria-selected={Boolean(cell.cellMeta.ariaSelected)}
                    aria-current={isoDate === todayIso ? 'date' : undefined}
                    disabled={cell.cellMeta.disabled}
                  >
                    <span className="calendar-day-number">{cell.date.getDate()}</span>
                    {cell.cellMeta.showIcon ? (
                      <span className="calendar-cell-icon" aria-hidden="true">
                        <CalendarDays size={14} />
                      </span>
                    ) : null}
                    {cell.cellMeta.badge ? <span className="calendar-cell-badge">{cell.cellMeta.badge}</span> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {compactList ? <div className="planning-compact-list">{compactList}</div> : null}
    </>
  );
}

export default PlanningCalendar;
