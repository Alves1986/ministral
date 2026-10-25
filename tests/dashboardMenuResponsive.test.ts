import { describe, it, expect } from 'vitest';

export function calculateSidebarCollapsedState(params: {
  isDesktop: boolean;
  isDesktopCollapsed: boolean;
  isSidebarHovered: boolean;
}): boolean {
  // O menu no mobile NÃO deve iniciar recuado nem ficar recuado; apenas no desktop pode colapsar
  return params.isDesktop && params.isDesktopCollapsed && !params.isSidebarHovered;
}

export function getSidebarWidthClasses(isEffectivelyCollapsed: boolean): string {
  return isEffectivelyCollapsed ? 'w-20 lg:w-[5.5rem]' : 'w-72 max-w-[85vw] lg:w-72';
}

describe('DashboardLayout Mobile vs Desktop Menu Behavior', () => {
  it('does NOT collapse menu on mobile even when isDesktopCollapsed is true', () => {
    // Cenário mobile (largura < 1024px)
    const isDesktop = false;
    const isDesktopCollapsed = true;
    const isSidebarHovered = false;

    const collapsed = calculateSidebarCollapsedState({
      isDesktop,
      isDesktopCollapsed,
      isSidebarHovered
    });

    // No mobile o menu DEVE ser normal (não colapsado)
    expect(collapsed).toBe(false);

    const widthClasses = getSidebarWidthClasses(collapsed);
    expect(widthClasses).toContain('w-72');
    expect(widthClasses).not.toBe('w-20 lg:w-[5.5rem]');
  });

  it('allows collapsing menu on desktop when isDesktopCollapsed is true and not hovered', () => {
    // Cenário desktop (largura >= 1024px)
    const isDesktop = true;
    const isDesktopCollapsed = true;
    const isSidebarHovered = false;

    const collapsed = calculateSidebarCollapsedState({
      isDesktop,
      isDesktopCollapsed,
      isSidebarHovered
    });

    // No desktop com collapsed=true e sem hover, deve colapsar
    expect(collapsed).toBe(true);

    const widthClasses = getSidebarWidthClasses(collapsed);
    expect(widthClasses).toBe('w-20 lg:w-[5.5rem]');
  });

  it('expands desktop menu when hovered even if isDesktopCollapsed is true', () => {
    const isDesktop = true;
    const isDesktopCollapsed = true;
    const isSidebarHovered = true;

    const collapsed = calculateSidebarCollapsedState({
      isDesktop,
      isDesktopCollapsed,
      isSidebarHovered
    });

    // Expandido pelo hover no desktop
    expect(collapsed).toBe(false);
  });

  it('expands desktop menu when isDesktopCollapsed is false', () => {
    const isDesktop = true;
    const isDesktopCollapsed = false;
    const isSidebarHovered = false;

    const collapsed = calculateSidebarCollapsedState({
      isDesktop,
      isDesktopCollapsed,
      isSidebarHovered
    });

    expect(collapsed).toBe(false);
  });
});
