import type { ReactNode } from "react";
import React from "react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Badge } from "@calcom/ui";

type EmailListCardProps = {
  email: string;
  actions?: ReactNode;
  isPrimary?: boolean;
  isVerified?: boolean;
};

const EmailListCard: React.FC<EmailListCardProps> = ({
  email,
  actions,
  isPrimary = false,
  isVerified = true,
}) => {
  const { t } = useLocale();

  return (
    <div className="bg-default w-full sm:mx-0 xl:mt-0">
      <div className="border-default mb-2 rounded-md border">
        <div className={`${actions ? "py-1" : "py-2"} flex justify-between  pl-3 pr-2`}>
          <div className="flex items-center space-x-2">
            <h5 className="text-sm">{email}</h5>
            {isPrimary && (
              <Badge variant="blue" className="ml-2">
                {t("primary")}
              </Badge>
            )}
            {!isVerified && (
              <Badge variant="orange" className="ml-2">
                {t("unverified")}
              </Badge>
            )}
          </div>
          {actions}
        </div>
      </div>
    </div>
  );
};

export default EmailListCard;
