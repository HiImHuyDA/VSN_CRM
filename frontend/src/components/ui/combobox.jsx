import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "../../lib/utils"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "cmdk"

export function ComboboxMultiple({ 
  options = [], 
  selected = [], 
  onChange, 
  placeholder = "Chọn...", 
  emptyText = "Không tìm thấy kết quả." 
}) {
  const [open, setOpen] = React.useState(false)

  const handleUnselect = (item) => {
    onChange(selected.filter((i) => i !== item))
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          role="combobox"
          aria-expanded={open}
          className="flex min-h-10 w-full items-center justify-between rounded-md border border-outline-variant bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div className="flex flex-wrap gap-1 items-center overflow-hidden">
            {selected.length === 0 && <span className="text-gray-500">{placeholder}</span>}
            {selected.includes("Chọn tất cả") ? (
              <span
                className="flex items-center gap-1 rounded bg-surface-container-highest px-2 py-0.5 text-xs text-on-surface"
              >
                Tất cả khách hàng
                <span
                  role="button"
                  tabIndex={0}
                  className="rounded-full hover:bg-gray-300 p-0.5 cursor-pointer"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange([]);
                  }}
                >
                  <X className="h-3 w-3" />
                </span>
              </span>
            ) : (
              selected.map((item) => (
                <span
                  key={item}
                  className="flex items-center gap-1 rounded bg-surface-container-highest px-2 py-0.5 text-xs text-on-surface"
                >
                  {item}
                  <span
                    role="button"
                    tabIndex={0}
                    className="rounded-full hover:bg-gray-300 p-0.5 cursor-pointer"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUnselect(item);
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleUnselect(item);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </span>
                </span>
              ))
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Content
        align="start"
        className="z-50 w-full min-w-[200px] rounded-md border bg-white p-0 shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
        style={{ width: "var(--radix-popover-trigger-width)" }}
      >
        <Command className="flex h-full w-full flex-col overflow-hidden rounded-md bg-white text-gray-950">
          <CommandInput 
            placeholder="Tìm kiếm..." 
            className="flex h-11 w-full rounded-md bg-transparent px-3 py-3 text-sm outline-none placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-50 border-b"
          />
          <CommandList className="max-h-[300px] overflow-y-auto overflow-x-hidden">
            <CommandEmpty className="py-6 text-center text-sm">{emptyText}</CommandEmpty>
            <CommandGroup className="overflow-hidden p-1 text-gray-950">
              {options.map((option) => {
                const isSelected = selected.includes(option);
                return (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={(currentValue) => {
                      if (isSelected) {
                        onChange(selected.filter((item) => item !== option));
                      } else {
                        onChange([...selected, option]);
                      }
                    }}
                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-gray-100 aria-selected:text-gray-900 data-[disabled='true']:pointer-events-none data-[disabled='true']:opacity-50"
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-white"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className={cn("h-4 w-4")} />
                    </div>
                    {option}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Root>
  )
}
