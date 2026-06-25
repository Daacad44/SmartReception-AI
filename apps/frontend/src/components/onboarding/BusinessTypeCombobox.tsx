import { useState, useEffect, useCallback, useMemo, forwardRef, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronsUpDown, Check, Search, Star, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  BUSINESS_TYPE_CATEGORIES,
  CATEGORY_THEMES,
  findBusinessType,
  getPopularBusinessTypes,
  getRecentBusinessTypes,
  addRecentBusinessType,
  searchBusinessTypes,
  type BusinessTypeOption,
} from '@/lib/business-types';
import { cn } from '@/lib/utils';

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

function BusinessTypeCard({
  type,
  selected,
  compact,
}: {
  type: BusinessTypeOption;
  selected: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border transition-all duration-150',
        compact ? 'p-2.5' : 'p-3',
        selected
          ? 'border-[#F59E0B] bg-[#FEF3C7] shadow-sm'
          : 'border-[#E5E7EB] bg-white hover:border-[#F59E0B]/40 hover:bg-[#1E293B]/[0.03]'
      )}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg bg-[#F8FAFC]',
          compact ? 'h-9 w-9 text-lg' : 'h-11 w-11 text-xl'
        )}
        aria-hidden
      >
        {type.icon}
      </span>
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-semibold text-[#0F172A]">{type.label}</p>
        <p className="truncate text-xs text-[#64748B]">{type.description}</p>
      </div>
      {selected && <Check className="h-4 w-4 shrink-0 text-[#F59E0B]" strokeWidth={2.5} />}
    </div>
  );
}

function TypeOptionButton({
  type,
  selected,
  onPick,
  compact,
  showStar,
}: {
  type: BusinessTypeOption;
  selected: boolean;
  onPick: (type: BusinessTypeOption) => void;
  compact?: boolean;
  showStar?: boolean;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={() => onPick(type)}
      className="relative w-full cursor-pointer rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]/50"
    >
      <BusinessTypeCard type={type} selected={selected} compact={compact} />
      {showStar && (
        <Star className="pointer-events-none absolute right-10 top-1/2 h-3 w-3 -translate-y-1/2 fill-[#F59E0B] text-[#F59E0B]" />
      )}
    </button>
  );
}

function BusinessTypeList({
  value,
  search,
  onSearchChange,
  onPick,
  isMobile,
}: {
  value?: string;
  search: string;
  onSearchChange: (q: string) => void;
  onPick: (type: BusinessTypeOption) => void;
  isMobile?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [recent, setRecent] = useState<BusinessTypeOption[]>([]);
  const popular = useMemo(() => getPopularBusinessTypes(), []);
  const isSearching = search.trim().length > 0;

  useEffect(() => {
    setRecent(getRecentBusinessTypes());
    inputRef.current?.focus();
  }, []);

  const filteredBusinessTypes = useMemo(
    () => (isSearching ? searchBusinessTypes(search) : []),
    [search, isSearching]
  );

  const filteredCategories = useMemo(() => {
    if (!isSearching) return BUSINESS_TYPE_CATEGORIES;
    const ids = new Set(filteredBusinessTypes.map((t) => t.id));
    return BUSINESS_TYPE_CATEGORIES.map(({ category, types }) => ({
      category,
      types: types.filter((t) => ids.has(t.id)),
    })).filter((c) => c.types.length > 0);
  }, [isSearching, filteredBusinessTypes]);

  const filteredPopular = useMemo(
    () => (isSearching ? popular.filter((t) => searchBusinessTypes(search).some((f) => f.id === t.id)) : popular),
    [isSearching, search, popular]
  );

  const filteredRecent = useMemo(
    () => (isSearching ? recent.filter((t) => searchBusinessTypes(search).some((f) => f.id === t.id)) : recent),
    [isSearching, search, recent]
  );

  useEffect(() => {
    console.log('Business Types:', BUSINESS_TYPE_CATEGORIES.flatMap((c) => c.types));
    console.log('Filtered:', isSearching ? filteredBusinessTypes : BUSINESS_TYPE_CATEGORIES.flatMap((c) => c.types));
  }, [isSearching, filteredBusinessTypes]);

  const hasResults =
    filteredCategories.length > 0 || filteredPopular.length > 0 || filteredRecent.length > 0;

  const handlePick = (type: BusinessTypeOption) => {
    addRecentBusinessType(type.id);
    setRecent(getRecentBusinessTypes());
    onPick(type);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="shrink-0 border-b border-[#E5E7EB] px-3 py-2">
        <div className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-3 focus-within:border-[#F59E0B]/50 focus-within:ring-2 focus-within:ring-[#F59E0B]/20">
          <Search className="h-4 w-4 shrink-0 text-[#94A3B8]" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search business types…"
            className="h-11 w-full border-0 bg-transparent text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
            autoComplete="off"
          />
          {search && (
            <button type="button" onClick={() => onSearchChange('')} className="text-[#94A3B8] hover:text-[#0F172A]">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div
        role="listbox"
        className={cn(
          'min-h-[200px] flex-1 overflow-y-auto overflow-x-hidden p-2 scrollbar-thin',
          isMobile ? 'max-h-[calc(100dvh-140px)]' : 'max-h-[400px]'
        )}
      >
        {!hasResults && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="text-sm font-medium text-[#0F172A]">No business types found</p>
            <p className="text-xs text-[#64748B]">Try a different search term</p>
          </div>
        )}

        {!isSearching && filteredRecent.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-2 px-1 py-2">
              <Clock className="h-3.5 w-3.5 text-[#64748B]" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#0F172A]/70">
                Recently Used
              </span>
            </div>
            <div className="space-y-1.5 px-1">
              {filteredRecent.slice(0, 3).map((type) => (
                <TypeOptionButton
                  key={`recent-${type.id}`}
                  type={type}
                  selected={value === type.id}
                  onPick={handlePick}
                  compact
                />
              ))}
            </div>
          </div>
        )}

        {!isSearching && filteredPopular.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-2 px-1 py-2">
              <Star className="h-3.5 w-3.5 text-[#F59E0B]" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#0F172A]/70">
                Popular Business Types
              </span>
            </div>
            <div className="space-y-1.5 px-1">
              {filteredPopular.map((type) => (
                <TypeOptionButton
                  key={`popular-${type.id}`}
                  type={type}
                  selected={value === type.id}
                  onPick={handlePick}
                  compact
                  showStar
                />
              ))}
            </div>
          </div>
        )}

        {filteredCategories.map(({ category, types }) => {
          const theme = CATEGORY_THEMES[category] ?? { section: '#F8FAFC', header: '#F1F5F9' };
          return (
            <div key={category} className="mb-2">
              <div
                className="overflow-hidden rounded-xl border border-[#E5E7EB]"
                style={{ backgroundColor: theme.section }}
              >
                <div
                  className="sticky top-0 z-10 border-b border-[#E5E7EB] px-4 py-2.5"
                  style={{ backgroundColor: theme.header }}
                >
                  <p className="text-xs font-bold uppercase tracking-widest text-[#0F172A]">{category}</p>
                </div>
                <div className="space-y-1.5 p-2">
                  {types.map((type) => (
                    <TypeOptionButton
                      key={type.id}
                      type={type}
                      selected={value === type.id}
                      onPick={handlePick}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface BusinessTypeComboboxProps {
  value?: string;
  selectedType?: BusinessTypeOption | null;
  onChange: (type: BusinessTypeOption) => void;
  onAfterSelect?: () => void;
  disabled?: boolean;
  className?: string;
  error?: string;
}

const TriggerButton = forwardRef<
  HTMLButtonElement,
  {
    open: boolean;
    selected?: BusinessTypeOption | null;
    disabled?: boolean;
    className?: string;
    error?: string;
    onClick?: () => void;
  }
>(function TriggerButton({ open, selected, disabled, className, error, onClick }, ref) {
  return (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'h-auto min-h-[52px] w-full justify-between rounded-xl border px-4 py-3 font-normal transition-all duration-200',
        error && 'border-red-400',
        selected
          ? 'border-[#F59E0B] bg-[#FEF3C7] text-[#0F172A] shadow-sm hover:bg-[#FEF3C7]/90'
          : 'border-[#E5E7EB] bg-white text-[#64748B] hover:border-[#0F172A]/20 hover:bg-[#F8FAFC]',
        className
      )}
    >
      {selected ? (
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/80 text-xl shadow-sm">
            {selected.icon}
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 shrink-0 text-[#F59E0B]" strokeWidth={2.5} />
              <span className="truncate font-semibold text-[#0F172A]">{selected.label}</span>
            </span>
            <span className="mt-0.5 block truncate text-xs text-[#64748B]">{selected.category}</span>
          </span>
        </span>
      ) : (
        <span className="flex items-center gap-2 text-[#64748B]">
          <Search className="h-4 w-4" />
          <span>Select business type</span>
        </span>
      )}
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-[#94A3B8]" />
    </Button>
  );
});

function DesktopDropdown({
  open,
  onClose,
  triggerRef,
  children,
}: {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePosition = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      setStyle({
        position: 'fixed',
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, triggerRef]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      onClose();
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998]" aria-hidden />
      <div
        ref={panelRef}
        style={style}
        className="z-[9999] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-2xl animate-in fade-in-0 zoom-in-95"
        role="dialog"
        aria-label="Business type selector"
      >
        {children}
      </div>
    </>,
    document.body
  );
}

export function BusinessTypeCombobox({
  value,
  selectedType,
  onChange,
  onAfterSelect,
  disabled,
  className,
  error,
}: BusinessTypeComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const isMobile = useIsMobile();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected =
    selectedType ?? (value ? findBusinessType(value) : undefined) ?? null;

  const handlePick = useCallback(
    (type: BusinessTypeOption) => {
      console.log('Selected business type:', type);
      onChange(type);
      setOpen(false);
      setSearch('');
      requestAnimationFrame(() => onAfterSelect?.());
    },
    [onChange, onAfterSelect]
  );

  const handleOpen = () => {
    if (!disabled) {
      setOpen(true);
      setSearch('');
    }
  };

  if (isMobile) {
    return (
      <div className="relative">
        <TriggerButton
          ref={triggerRef}
          open={open}
          selected={selected}
          disabled={disabled}
          className={className}
          error={error}
          onClick={handleOpen}
        />
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="flex h-[100dvh] flex-col rounded-none border-0 p-0"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[#E5E7EB] px-4 py-4">
              <div>
                <p className="text-base font-semibold text-[#0F172A]">Business Type</p>
                <p className="text-xs text-[#64748B]">Search and select your industry</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
            <BusinessTypeList
              value={value}
              search={search}
              onSearchChange={setSearch}
              onPick={handlePick}
              isMobile
            />
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="relative overflow-visible">
      <TriggerButton
        ref={triggerRef}
        open={open}
        selected={selected}
        disabled={disabled}
        className={className}
        error={error}
        onClick={() => (open ? setOpen(false) : handleOpen())}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      <DesktopDropdown open={open} onClose={() => setOpen(false)} triggerRef={triggerRef}>
        <BusinessTypeList
          value={value}
          search={search}
          onSearchChange={setSearch}
          onPick={handlePick}
        />
      </DesktopDropdown>
    </div>
  );
}

export { findBusinessType };
export type { BusinessTypeOption };
