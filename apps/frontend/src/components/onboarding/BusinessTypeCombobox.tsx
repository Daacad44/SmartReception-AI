import { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { ChevronsUpDown, Check, Search, Star, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import {
  BUSINESS_TYPE_CATEGORIES,
  CATEGORY_THEMES,
  findBusinessType,
  getPopularBusinessTypes,
  getRecentBusinessTypes,
  addRecentBusinessType,
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

const BusinessTypeCard = memo(function BusinessTypeCard({
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
        'flex w-full items-center gap-3 rounded-xl border p-3 transition-all duration-150',
        compact ? 'p-2.5' : 'p-3',
        selected
          ? 'border-[#F59E0B] bg-[#FEF3C7] shadow-sm'
          : 'border-[#E5E7EB] bg-white group-aria-selected:border-[#F59E0B] group-aria-selected:bg-[#FEF3C7] group-aria-selected:shadow-sm group-hover:border-[#F59E0B]/30 group-hover:bg-[#1E293B]/[0.03]'
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
        <p className={cn('truncate font-semibold text-[#0F172A]', compact ? 'text-sm' : 'text-sm')}>
          {type.label}
        </p>
        <p className="truncate text-xs text-[#64748B]">{type.description}</p>
      </div>
      {selected ? (
        <Check className="h-4 w-4 shrink-0 text-[#F59E0B]" strokeWidth={2.5} />
      ) : (
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[#94A3B8] opacity-0 transition-opacity group-aria-selected:opacity-100" />
      )}
    </div>
  );
});

const SectionHeader = memo(function SectionHeader({
  title,
  icon: Icon,
  accent,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-1 py-2">
      {Icon && (
        <Icon className={cn('h-3.5 w-3.5', accent ? 'text-[#F59E0B]' : 'text-[#64748B]')} />
      )}
      <span className="text-[11px] font-bold uppercase tracking-widest text-[#0F172A]/70">
        {title}
      </span>
    </div>
  );
});

const BusinessTypePalette = memo(function BusinessTypePalette({
  value,
  onSelect,
  onClose,
  isMobile,
}: {
  value?: string;
  onSelect: (type: BusinessTypeOption) => void;
  onClose?: () => void;
  isMobile?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [recent, setRecent] = useState<BusinessTypeOption[]>([]);

  useEffect(() => {
    setRecent(getRecentBusinessTypes());
  }, []);

  const popular = useMemo(() => getPopularBusinessTypes(), []);
  const isSearching = search.trim().length > 0;

  const handlePick = useCallback(
    (type: BusinessTypeOption) => {
      addRecentBusinessType(type.id);
      setRecent(getRecentBusinessTypes());
      onSelect(type);
      onClose?.();
    },
    [onSelect, onClose]
  );

  const recentFiltered = recent.filter((t) => !value || t.id !== value || isSearching);

  return (
    <Command
      shouldFilter
      value={search}
      onValueChange={setSearch}
      filter={(itemValue, searchTerm, keywords) => {
        const haystack = [itemValue, ...(keywords ?? [])].join(' ').toLowerCase();
        return haystack.includes(searchTerm.toLowerCase()) ? 1 : 0;
      }}
      className="flex h-full flex-col bg-white"
    >
      <div className="border-b border-[#E5E7EB] px-3 py-2">
        <div className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-3 transition-colors focus-within:border-[#F59E0B]/50 focus-within:ring-2 focus-within:ring-[#F59E0B]/20">
          <Search className="h-4 w-4 shrink-0 text-[#94A3B8]" />
          <CommandInput
            placeholder="Search business types…"
            className="h-11 border-0 bg-transparent px-0 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus-visible:ring-0"
          />
          <kbd className="hidden shrink-0 rounded-md border border-[#E5E7EB] bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#94A3B8] sm:inline">
            ⌘K
          </kbd>
        </div>
      </div>

      <CommandList
        className={cn(
          'flex-1 overflow-y-auto overflow-x-hidden p-2 scrollbar-thin',
          isMobile ? 'max-h-none' : 'max-h-[500px]'
        )}
      >
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Sparkles className="h-8 w-8 text-[#F59E0B]/60" />
            <p className="text-sm font-medium text-[#0F172A]">No business types found</p>
            <p className="text-xs text-[#64748B]">Try a different search term</p>
          </div>
        </CommandEmpty>

        {!isSearching && recentFiltered.length > 0 && (
          <CommandGroup className="p-0 [&_[cmdk-group-heading]]:hidden">
            <SectionHeader title="Recently Used" icon={Clock} />
            <div className="space-y-1.5 px-1 pb-3">
              {recentFiltered.slice(0, 3).map((type) => (
                <CommandItem
                  key={`recent-${type.id}`}
                  value={type.id}
                  keywords={[type.label, type.category, type.description, ...type.keywords, 'recent']}
                  onSelect={() => handlePick(type)}
                  onPointerDown={(e) => e.preventDefault()}
                  onMouseDown={(e) => e.preventDefault()}
                  className="group cursor-pointer rounded-xl p-0 aria-selected:bg-transparent data-[selected=true]:bg-transparent"
                >
                  <BusinessTypeCard type={type} selected={value === type.id} compact />
                </CommandItem>
              ))}
            </div>
          </CommandGroup>
        )}

        {!isSearching && (
          <CommandGroup className="p-0 [&_[cmdk-group-heading]]:hidden">
            <SectionHeader title="Popular Business Types" icon={Star} accent />
            <div className="space-y-1.5 px-1 pb-4">
              {popular.map((type) => (
                <CommandItem
                  key={`popular-${type.id}`}
                  value={type.id}
                  keywords={[type.label, type.category, type.description, ...type.keywords, 'popular']}
                  onSelect={() => handlePick(type)}
                  onPointerDown={(e) => e.preventDefault()}
                  onMouseDown={(e) => e.preventDefault()}
                  className="group cursor-pointer rounded-xl p-0 aria-selected:bg-transparent data-[selected=true]:bg-transparent"
                >
                  <div className="relative w-full">
                    <BusinessTypeCard type={type} selected={value === type.id} compact />
                    <Star className="absolute right-10 top-1/2 h-3 w-3 -translate-y-1/2 fill-[#F59E0B] text-[#F59E0B]" />
                  </div>
                </CommandItem>
              ))}
            </div>
          </CommandGroup>
        )}

        {BUSINESS_TYPE_CATEGORIES.map(({ category, types }) => {
          const theme = CATEGORY_THEMES[category] ?? { section: '#F8FAFC', header: '#F1F5F9' };
          return (
            <CommandGroup
              key={category}
              heading={category}
              className="mb-2 overflow-hidden rounded-xl p-0 [&_[cmdk-group-heading]]:hidden"
            >
              <div
                className="overflow-hidden rounded-xl border border-[#E5E7EB]"
                style={{ backgroundColor: theme.section }}
              >
                <div
                  className="sticky top-0 z-10 border-b border-[#E5E7EB] px-4 py-2.5"
                  style={{ backgroundColor: theme.header }}
                >
                  <p className="text-xs font-bold uppercase tracking-widest text-[#0F172A]">
                    {category}
                  </p>
                </div>
                <div className="space-y-1.5 p-2">
                  {types.map((type) => (
                    <CommandItem
                      key={type.id}
                      value={type.id}
                      keywords={[type.label, type.category, type.description, ...type.keywords]}
                      onSelect={() => handlePick(type)}
                      onPointerDown={(e) => e.preventDefault()}
                      onMouseDown={(e) => e.preventDefault()}
                      className="group cursor-pointer rounded-xl p-0 aria-selected:bg-transparent data-[selected=true]:bg-transparent [&:hover_.bt-card]:border-[#F59E0B]/30 [&:hover_.bt-card]:bg-white"
                    >
                      <div className="bt-card w-full transition-all duration-150">
                        <BusinessTypeCard type={type} selected={value === type.id} />
                      </div>
                    </CommandItem>
                  ))}
                </div>
              </div>
            </CommandGroup>
          );
        })}
      </CommandList>
    </Command>
  );
});

interface BusinessTypeComboboxProps {
  value?: string;
  onChange: (type: BusinessTypeOption) => void;
  onAfterSelect?: () => void;
  disabled?: boolean;
  className?: string;
}

function TriggerButton({
  open,
  selected,
  disabled,
  className,
  onClick,
}: {
  open: boolean;
  selected?: BusinessTypeOption;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'h-auto min-h-[52px] w-full justify-between rounded-xl border px-4 py-3 font-normal transition-all duration-200',
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
}

export function BusinessTypeCombobox({
  value,
  onChange,
  onAfterSelect,
  disabled,
  className,
}: BusinessTypeComboboxProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const selected = value ? findBusinessType(value) : undefined;

  const handleSelect = useCallback(
    (type: BusinessTypeOption) => {
      onChange(type);
      setOpen(false);
      requestAnimationFrame(() => onAfterSelect?.());
    },
    [onChange, onAfterSelect]
  );

  if (isMobile) {
    return (
      <>
        <TriggerButton
          open={open}
          selected={selected}
          disabled={disabled}
          className={className}
          onClick={() => !disabled && setOpen(true)}
        />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="flex h-[100dvh] flex-col rounded-none border-0 p-0 data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-4">
              <div>
                <p className="text-base font-semibold text-[#0F172A]">Business Type</p>
                <p className="text-xs text-[#64748B]">Search and select your industry</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-[#64748B]"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
              <BusinessTypePalette
                value={value}
                onSelect={handleSelect}
                onClose={() => setOpen(false)}
                isMobile
              />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <TriggerButton open={open} selected={selected} disabled={disabled} className={className} />
      </PopoverTrigger>
      <PopoverContent
        className="z-[130] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl border-[#E5E7EB] p-0 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        align="start"
        side="bottom"
        sideOffset={8}
        collisionPadding={8}
        avoidCollisions={false}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <BusinessTypePalette
          value={value}
          onSelect={handleSelect}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

export { findBusinessType };
