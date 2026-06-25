import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, User, Phone } from 'lucide-react';
import api, { extractData } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Customer {
  id: string;
  name: string;
  phone: string;
  whatsappNumber?: string | null;
}

interface CustomerSearchSelectProps {
  value?: string;
  onSelect: (customer: Customer | null) => void;
  disabled?: boolean;
}

export function CustomerSearchSelect({ value, onSelect, disabled }: CustomerSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: selectedCustomer } = useQuery({
    queryKey: ['customer', value],
    queryFn: async () => extractData<Customer>(await api.get(`/customers/${value}`)),
    enabled: !!value,
    staleTime: 60_000,
  });

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers-search', search],
    queryFn: async () =>
      extractData<Customer[]>(
        await api.get('/customers', { params: { search: search || undefined, limit: 20, page: 1 } })
      ),
    enabled: open,
    staleTime: 30_000,
  });

  const selected = selectedCustomer ?? customers?.find((c) => c.id === value);

  const displayLabel = selected
    ? `${selected.name} · ${selected.whatsappNumber || selected.phone}`
    : 'Search customer by name or phone';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn('h-10 w-full justify-start font-normal', !value && 'text-muted-foreground')}
        >
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <span className="truncate">{displayLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="border-b p-2">
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="h-9"
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1 scrollbar-thin">
          {isLoading && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Searching...</p>
          )}
          {!isLoading && customers?.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No customers found</p>
          )}
          {customers?.map((customer) => (
            <button
              key={customer.id}
              type="button"
              className={cn(
                'flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm hover:bg-accent/10',
                value === customer.id && 'bg-accent/10'
              )}
              onClick={() => {
                onSelect(customer);
                setOpen(false);
              }}
            >
              <span className="flex items-center gap-2 font-medium">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                {customer.name}
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                {customer.whatsappNumber || customer.phone}
              </span>
            </button>
          ))}
        </div>
        {value && (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => onSelect(null)}
            >
              Clear selection
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
