import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlanningCalendar from '../components/Forms/PlanningCalendar';

describe('PlanningCalendar', () => {
  it('renders an accessible calendar grid with selected and disabled days', async () => {
    const onSelectDate = vi.fn();

    render(
      <PlanningCalendar
        year={2026}
        month={0}
        onMonthChange={vi.fn()}
        onSelectDate={onSelectDate}
        getCellMeta={(isoDate) => ({
          title: isoDate === '2026-01-06' ? 'Sin clase registrada' : 'Seleccionar clase',
          ariaLabel: isoDate === '2026-01-06' ? `${isoDate}: sin clase registrada` : `${isoDate}: clase registrada`,
          ariaSelected: isoDate === '2026-01-05',
          disabled: isoDate === '2026-01-06',
        })}
      />,
    );

    expect(screen.getByRole('grid', { name: /calendario de enero de 2026/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Lunes' })).toBeInTheDocument();

    const selectedDay = screen.getByRole('gridcell', { name: '2026-01-05: clase registrada' });
    const disabledDay = screen.getByRole('gridcell', { name: '2026-01-06: sin clase registrada' });

    expect(selectedDay).toHaveAttribute('aria-selected', 'true');
    expect(disabledDay).toBeDisabled();

    await userEvent.click(selectedDay);

    expect(onSelectDate).toHaveBeenCalledWith('2026-01-05');
  });

  it('supports arrow-key navigation between enabled days', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PlanningCalendar
        year={2026}
        month={0}
        onMonthChange={vi.fn()}
        onSelectDate={vi.fn()}
        getCellMeta={(isoDate) => ({ disabled: isoDate === '2026-01-06' })}
      />,
    );

    const monday = container.querySelector<HTMLButtonElement>('[data-calendar-date="2026-01-05"]');
    const wednesday = container.querySelector<HTMLButtonElement>('[data-calendar-date="2026-01-07"]');

    monday?.focus();
    await user.keyboard('{ArrowRight}');

    expect(wednesday).toHaveFocus();
  });
});
