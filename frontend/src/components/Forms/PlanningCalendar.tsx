import type { ReactNode } from 'react';
import { CalendarDays } from 'lucide-react';

interface CalendarCellMeta {
  className?: string;
  disabled?: boolean;
  title?: string;
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

const DAY_NAMES = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

function dateToIso(date: Date): string {
  return date.toISOString().slice(0, 10);
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

  const calendarCells = buildCalendarCells(year, month);

  return (
    <>
      <div className="calendar-toolbar">
        <button className="button button-ghost" type="button" onClick={() => onMonthChange(Math.max(0, month - 1))}>
          Mes anterior
        </button>
        <strong>{monthLabel}</strong>
        <button className="button button-ghost" type="button" onClick={() => onMonthChange(Math.min(11, month + 1))}>
          Mes siguiente
        </button>
      </div>

      <div className="calendar-grid">
        {DAY_NAMES.map((day) => (
          <div className="calendar-head" key={day}>
            {day}
          </div>
        ))}
        {calendarCells.map((cell, index) => {
          if (!cell.iso || !cell.date) {
            return <div className="calendar-cell muted-cell" key={`empty-${index}`} />;
          }

          const cellMeta = getCellMeta?.(cell.iso, cell.date) || {};

          return (
            <button
              className={`calendar-cell ${cellMeta.className || ''}`.trim()}
              type="button"
              key={cell.iso}
              onClick={() => onSelectDate(cell.iso as string)}
              title={cellMeta.title || 'Seleccionar fecha'}
              disabled={cellMeta.disabled}
            >
              <span>{cell.date.getDate()}</span>
              {cellMeta.showIcon ? <CalendarDays size={14} /> : null}
              {cellMeta.badge}
            </button>
          );
        })}
      </div>

      {compactList ? <div className="planning-compact-list">{compactList}</div> : null}
    </>
  );
}

export default PlanningCalendar;
