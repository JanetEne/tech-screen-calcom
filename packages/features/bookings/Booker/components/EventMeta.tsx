import { m } from "framer-motion";
import dynamic from "next/dynamic";

import { useEmbedUiConfig, useIsEmbed } from "@calcom/embed-core/embed-iframe";
import { EventDetails, EventMembers, EventMetaSkeleton, EventTitle } from "@calcom/features/bookings";
import { EventMetaBlock } from "@calcom/features/bookings/components/event-meta/Details";
import { useTimePreferences } from "@calcom/features/bookings/lib";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { markdownToSafeHTML } from "@calcom/lib/markdownToSafeHTML";
import { Calendar, Globe } from "@calcom/ui/components/icon";

import { fadeInUp } from "../config";
import { useBookerStore } from "../store";
import { FromToTime } from "../utils/dates";
import { useEvent } from "../utils/event";

const TimezoneSelect = dynamic(() => import("@calcom/ui").then((mod) => mod.TimezoneSelect), {
  ssr: false,
});

export const EventMeta = () => {
  const { timezone, setTimezone, timeFormat } = useTimePreferences();
  const selectedDuration = useBookerStore((state) => state.selectedDuration);
  const selectedTimeslot = useBookerStore((state) => state.selectedTimeslot);
  const bookerState = useBookerStore((state) => state.state);
  const rescheduleBooking = useBookerStore((state) => state.rescheduleBooking);
  const { i18n, t } = useLocale();
  const { data: event, isLoading } = useEvent();
  const embedUiConfig = useEmbedUiConfig();
  const isEmbed = useIsEmbed();
  const hideEventTypeDetails = isEmbed ? embedUiConfig.hideEventTypeDetails : false;

  if (hideEventTypeDetails) {
    return null;
  }

  return (
    <div className="relative z-10 p-6">
      {isLoading && (
        <m.div {...fadeInUp} initial="visible" layout>
          <EventMetaSkeleton />
        </m.div>
      )}
      {!isLoading && !!event && (
        <m.div {...fadeInUp} layout transition={{ ...fadeInUp.transition, delay: 0.3 }}>
          <EventMembers schedulingType={event.schedulingType} users={event.users} profile={event.profile} />
          <EventTitle className="my-2">{event?.title}</EventTitle>
          {event.description && (
            <EventMetaBlock contentClassName="mb-8 break-words max-w-full max-h-[180px] scroll-bar pr-4">
              <div dangerouslySetInnerHTML={{ __html: markdownToSafeHTML(event.description) }} />
            </EventMetaBlock>
          )}
          <div className="space-y-4 font-medium">
            {rescheduleBooking && (
              <EventMetaBlock icon={Calendar}>
                {t("former_time")}
                <br />
                <span className="line-through" data-testid="former_time_p">
                  <FromToTime
                    date={rescheduleBooking.startTime.toString()}
                    duration={null}
                    timeFormat={timeFormat}
                    timeZone={timezone}
                    language={i18n.language}
                  />
                </span>
              </EventMetaBlock>
            )}
            {selectedTimeslot && (
              <EventMetaBlock icon={Calendar}>
                <FromToTime
                  date={selectedTimeslot}
                  duration={selectedDuration || event.length}
                  timeFormat={timeFormat}
                  timeZone={timezone}
                  language={i18n.language}
                />
              </EventMetaBlock>
            )}
            <EventDetails event={event} />
            <EventMetaBlock
              className="cursor-pointer [&_.current-timezone:before]:focus-within:opacity-100 [&_.current-timezone:before]:hover:opacity-100"
              contentClassName="relative max-w-[90%]"
              icon={Globe}>
              {bookerState === "booking" ? (
                <>{timezone}</>
              ) : (
                <span className="min-w-32 current-timezone before:bg-subtle -mt-[2px] flex h-6 max-w-full items-center justify-start before:absolute before:inset-0 before:left-[-30px] before:top-[-3px] before:bottom-[-3px] before:w-[calc(100%_+_35px)] before:rounded-md before:py-3 before:opacity-0 before:transition-opacity">
                  <TimezoneSelect
                    menuPosition="fixed"
                    classNames={{
                      control: () => "!min-h-0 p-0 w-full border-0 bg-transparent focus-within:ring-0",
                      menu: () => "!w-64 max-w-[90vw]",
                      singleValue: () => "text-text py-1",
                      indicatorsContainer: () => "ml-auto",
                      container: () => "max-w-full",
                    }}
                    value={timezone}
                    onChange={(tz) => setTimezone(tz.value)}
                  />
                </span>
              )}
            </EventMetaBlock>
          </div>
        </m.div>
      )}
    </div>
  );
};
