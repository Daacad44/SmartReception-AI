import { useState, useEffect, useCallback, memo } from 'react';
import { ChevronsUpDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import {
  ALL_BUSINESS_TYPES,
  BUSINESS_TYPE_CATEGORIES,
  findBusinessType,
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

const BusinessTypeList = memo(function BusinessTypeList({
  value,
  onSelect,
  onClose,
}: {
  value?: string;
  onSelect: (type: BusinessTypeOption) => void;
  onClose?: () => void;
}) {
  return (
    <Command shouldFilter>
      <CommandInput placeholder="Search business type..." />
      <CommandList className="max-h-[min(400px,50vh)]">
        <CommandEmpty>No business type found.</CommandEmpty>
        {BUSINESS_TYPE_CATEGORIES.map(({ category, types }) => (
          <CommandGroup key={category} heading={category}>
            {types.map((type) => (
              <CommandItem
                key={type.id}
                value={`${type.label} ${type.category} ${type.keywords.join(' ')}`}
                onSelect={() => {
                  onSelect(type);
                  onClose?.();
                }}
              >
                <span className="text-base leading-none" aria-hidden>{type.icon}</span>
                <span className="flex-1 truncate">{type.label}</span>
                {value === type.id && <Check className="h-4 w-4 shrink-0 text-accent" />}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  );
});

interface BusinessTypeComboboxProps {
  value?: string;
  onChange: (type: BusinessTypeOption) => void;
  disabled?: boolean;
  className?: string;
}

export function BusinessTypeCombobox({ value, onChange, disabled, className }: BusinessTypeComboboxProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const selected = value ? findBusinessType(value) : undefined;

  const handleSelect = useCallback(
    (type: BusinessTypeOption) => {
      onChange(type);
      setOpen(false);
    },
    [onChange]
  );

  const trigger = (
    <Button
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      disabled={disabled}
      className={cn('h-10 w-full justify-between font-normal', !selected && 'text-muted-foreground', className)}
    >
      <span className="flex items-center gap-2 truncate">
        {selected ? (
          <>
            <span className="text-base leading-none">{selected.icon}</span>
            <span className="truncate">{selected.label}</span>
          </>
        ) : (
          'Select business type'
        )}
      </span>
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );

  if (isMobile) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen(true)}
          className={cn('h-10 w-full justify-between font-normal', !selected && 'text-muted-foreground', className)}
        >
          <span className="flex items-center gap-2 truncate">
            {selected ? (
              <>
                <span className="text-base leading-none">{selected.icon}</span>
                <span className="truncate">{selected.label}</span>
              </>
            ) : (
              'Select business type'
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="flex h-[90vh] flex-col rounded-t-xl p-0">
            <SheetHeader className="border-b px-4 py-3 text-left">
              <SheetTitle>Business Type</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-hidden p-2">
              <BusinessTypeList value={value} onSelect={handleSelect} onClose={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="z-[130] w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        side="bottom"
        sideOffset={8}
        collisionPadding={8}
        avoidCollisions={false}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <BusinessTypeList value={value} onSelect={handleSelect} onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

export { ALL_BUSINESS_TYPES, findBusinessType };
