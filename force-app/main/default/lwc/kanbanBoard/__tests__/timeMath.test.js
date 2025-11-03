import { displayToMinutes, minutesToDisplay, normalizeDisplay, stepMinus15, stepPlus15 } from '../timeMath';

describe('timeMath helpers', () => {
    test('displayToMinutes normalizes overflow and parses', () => {
        expect(displayToMinutes('1.30')).toBe(90);
        expect(displayToMinutes('0.45')).toBe(45);
        expect(displayToMinutes('1.75')).toBe(135); // 1h 75m => 2h 15m
    });

    test('minutesToDisplay formats hours.mm', () => {
        expect(minutesToDisplay(90)).toBe('1.30');
        expect(minutesToDisplay(0)).toBe('0.00');
        expect(minutesToDisplay(135)).toBe('2.15');
    });

    test('stepPlus15 and stepMinus15 adjust by 15 minutes with clamp at 0', () => {
        expect(stepPlus15('0.45')).toBe('1.00');
        expect(stepMinus15('1.00')).toBe('0.45');
        expect(stepMinus15('0.00')).toBe('0.00');
    });

    test('normalizeDisplay coerces to base-60', () => {
        expect(normalizeDisplay('1.75')).toBe('2.15');
    });
});
