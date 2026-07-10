import * as React from "react"
import { formatDate } from "../../utils/helpers"
import { Calendar as CalendarIcon, X } from "lucide-react"

import { cn } from "../../lib/utils"
import { Calendar } from "./calendar"
import * as PopoverPrimitive from "@radix-ui/react-popover"

export function DateRangePicker({
  date,
  setDate,
  className,
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <PopoverPrimitive.Root>
        <PopoverPrimitive.Trigger asChild>
          <button
            id="date"
            className={cn(
              "flex min-h-10 w-full items-center justify-start text-left font-normal rounded-md border border-outline-variant bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20",
              !date && "text-gray-500"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            <div className="flex-1 truncate">
              {date?.from ? (
                date.to ? (
                  <>
                    {formatDate(date.from, "dd/MM/yyyy")} -{" "}
                    {formatDate(date.to, "dd/MM/yyyy")}
                  </>
                ) : (
                  formatDate(date.from, "dd/MM/yyyy")
                )
              ) : (
                <span>Chọn ngày...</span>
              )}
            </div>
            {date?.from && (
              <div
                role="button"
                className="ml-2 hover:bg-gray-100 p-0.5 rounded-full"
                onClick={(e) => {
                  e.stopPropagation()
                  setDate(undefined)
                }}
              >
                <X className="h-4 w-4" />
              </div>
            )}
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Content
          className="w-auto p-0 z-50 rounded-md border bg-white shadow-md outline-none"
          align="start"
        >
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Root>
    </div>
  )
}
