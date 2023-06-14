import { zodResolver } from "@hookform/resolvers/zod";
import { IdentityProvider } from "@prisma/client";
import { signOut } from "next-auth/react";
import type { BaseSyntheticEvent } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { ErrorCode } from "@calcom/features/auth/lib/ErrorCode";
import { getLayout } from "@calcom/features/settings/layouts/SettingsLayout";
import { FULL_NAME_LENGTH_MAX_LIMIT } from "@calcom/lib/constants";
import { APP_NAME } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { md } from "@calcom/lib/markdownIt";
import turndown from "@calcom/lib/turndownService";
import type { TRPCClientErrorLike } from "@calcom/trpc/client";
import { trpc } from "@calcom/trpc/react";
import type { AppRouter } from "@calcom/trpc/server/routers/_app";
import {
  Alert,
  Avatar,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
  Form,
  ImageUploader,
  Label,
  Meta,
  PasswordField,
  showToast,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonContainer,
  SkeletonText,
  TextField,
  Editor,
  DialogHeader,
  Dropdown,
  DropdownItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@calcom/ui";
import {
  FiAlertTriangle,
  FiFlag,
  FiMail,
  FiMoreHorizontal,
  FiPlus,
  FiTrash,
  FiTrash2,
} from "@calcom/ui/components/icon";

import EmailListCard from "@components/EmailListCard";
import TwoFactor from "@components/auth/TwoFactor";
import { UsernameAvailabilityField } from "@components/ui/UsernameAvailability";

const SkeletonLoader = ({ title, description }: { title: string; description: string }) => {
  return (
    <SkeletonContainer>
      <Meta title={title} description={description} />
      <div className="mt-6 mb-8 space-y-6">
        <div className="flex items-center">
          <SkeletonAvatar className="h-12 w-12 px-4" />
          <SkeletonButton className="h-6 w-32 rounded-md p-5" />
        </div>
        <SkeletonText className="h-8 w-full" />
        <SkeletonText className="h-8 w-full" />
        <SkeletonText className="h-8 w-full" />

        <SkeletonButton className="mr-6 h-8 w-20 rounded-md p-5" />
      </div>
    </SkeletonContainer>
  );
};

interface DeleteAccountValues {
  totpCode: string;
}

interface Emails {
  email: string;
  isVerified: boolean;
  isPrimary: boolean;
}

type FormValues = {
  username: string;
  avatar: string;
  name: string;
  email: string;
  bio: string;
  emails: Emails[];
};

const ProfileView = () => {
  const { t } = useLocale();
  const utils = trpc.useContext();
  const { data: user, isLoading } = trpc.viewer.me.useQuery();
  const { data: avatar, isLoading: isLoadingAvatar } = trpc.viewer.avatar.useQuery();
  const mutation = trpc.viewer.updateProfile.useMutation({
    onSuccess: () => {
      showToast(t("settings_updated_successfully"), "success");
      utils.viewer.me.invalidate();
      utils.viewer.avatar.invalidate();
      setTempFormValues(null);
    },
    onError: () => {
      showToast(t("error_updating_settings"), "error");
    },
  });

  const [confirmPasswordOpen, setConfirmPasswordOpen] = useState(false);
  const [tempFormValues, setTempFormValues] = useState<FormValues | null>(null);
  const [confirmPasswordErrorMessage, setConfirmPasswordDeleteErrorMessage] = useState("");

  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [hasDeleteErrors, setHasDeleteErrors] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState("");
  const form = useForm<DeleteAccountValues>();

  const onDeleteMeSuccessMutation = async () => {
    await utils.viewer.me.invalidate();
    showToast(t("Your account was deleted"), "success");

    setHasDeleteErrors(false); // dismiss any open errors
    if (process.env.NEXT_PUBLIC_WEBAPP_URL === "https://app.cal.com") {
      signOut({ callbackUrl: "/auth/logout?survey=true" });
    } else {
      signOut({ callbackUrl: "/auth/logout" });
    }
  };

  const confirmPasswordMutation = trpc.viewer.auth.verifyPassword.useMutation({
    onSuccess() {
      if (tempFormValues) mutation.mutate(tempFormValues);
      setConfirmPasswordOpen(false);
    },
    onError() {
      setConfirmPasswordDeleteErrorMessage(t("incorrect_password"));
    },
  });

  const onDeleteMeErrorMutation = (error: TRPCClientErrorLike<AppRouter>) => {
    setHasDeleteErrors(true);
    setDeleteErrorMessage(errorMessages[error.message]);
  };
  const deleteMeMutation = trpc.viewer.deleteMe.useMutation({
    onSuccess: onDeleteMeSuccessMutation,
    onError: onDeleteMeErrorMutation,
    async onSettled() {
      await utils.viewer.me.invalidate();
    },
  });
  const deleteMeWithoutPasswordMutation = trpc.viewer.deleteMeWithoutPassword.useMutation({
    onSuccess: onDeleteMeSuccessMutation,
    onError: onDeleteMeErrorMutation,
    async onSettled() {
      await utils.viewer.me.invalidate();
    },
  });

  const isCALIdentityProviver = user?.identityProvider === IdentityProvider.CAL;

  const onConfirmPassword = (e: Event | React.MouseEvent<HTMLElement, MouseEvent>) => {
    e.preventDefault();

    const password = passwordRef.current.value;
    confirmPasswordMutation.mutate({ passwordInput: password });
  };

  const onConfirmButton = (e: Event | React.MouseEvent<HTMLElement, MouseEvent>) => {
    e.preventDefault();
    if (isCALIdentityProviver) {
      const totpCode = form.getValues("totpCode");
      const password = passwordRef.current.value;
      deleteMeMutation.mutate({ password, totpCode });
    } else {
      deleteMeWithoutPasswordMutation.mutate();
    }
  };

  const onConfirm = ({ totpCode }: DeleteAccountValues, e: BaseSyntheticEvent | undefined) => {
    e?.preventDefault();
    if (isCALIdentityProviver) {
      const password = passwordRef.current.value;
      deleteMeMutation.mutate({ password, totpCode });
    } else {
      deleteMeWithoutPasswordMutation.mutate();
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const passwordRef = useRef<HTMLInputElement>(null!);

  const errorMessages: { [key: string]: string } = {
    [ErrorCode.SecondFactorRequired]: t("2fa_enabled_instructions"),
    [ErrorCode.IncorrectPassword]: `${t("incorrect_password")} ${t("please_try_again")}`,
    [ErrorCode.UserNotFound]: t("no_account_exists"),
    [ErrorCode.IncorrectTwoFactorCode]: `${t("incorrect_2fa_code")} ${t("please_try_again")}`,
    [ErrorCode.InternalServerError]: `${t("something_went_wrong")} ${t("please_try_again_and_contact_us")}`,
    [ErrorCode.ThirdPartyIdentityProviderEnabled]: t("account_created_with_identity_provider"),
  };

  if (isLoading || !user || isLoadingAvatar || !avatar)
    return (
      <SkeletonLoader title={t("profile")} description={t("profile_description", { appName: APP_NAME })} />
    );

  const defaultValues = {
    username: user.username || "",
    avatar: avatar.avatar || "",
    name: user.name || "",
    email: user.email || "",
    bio: user.bio || "",
    emails: user.emails || [],
  };

  return (
    <>
      <Meta title={t("profile")} description={t("profile_description", { appName: APP_NAME })} />
      <ProfileForm
        key={JSON.stringify(defaultValues)}
        defaultValues={defaultValues}
        onSubmit={(values) => {
          if (values.email !== user.email && isCALIdentityProviver) {
            setTempFormValues(values);
            setConfirmPasswordOpen(true);
          } else {
            mutation.mutate(values);
          }
        }}
        extraField={
          <div className="mt-8">
            <UsernameAvailabilityField
              user={user}
              onSuccessMutation={async () => {
                showToast(t("settings_updated_successfully"), "success");
                await utils.viewer.me.invalidate();
              }}
              onErrorMutation={() => {
                showToast(t("error_updating_settings"), "error");
              }}
            />
          </div>
        }
      />

      <hr className="border-subtle my-6" />

      <Label>{t("danger_zone")}</Label>
      {/* Delete account Dialog */}
      <Dialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
        <DialogTrigger asChild>
          <Button data-testid="delete-account" color="destructive" className="mt-1" StartIcon={FiTrash2}>
            {t("delete_account")}
          </Button>
        </DialogTrigger>
        <DialogContent
          title={t("delete_account_modal_title")}
          description={t("confirm_delete_account_modal", { appName: APP_NAME })}
          type="creation"
          Icon={FiAlertTriangle}>
          <>
            <p className="text-default mb-7">
              {t("delete_account_confirmation_message", { appName: APP_NAME })}
            </p>
            {isCALIdentityProviver && (
              <PasswordField
                data-testid="password"
                name="password"
                id="password"
                autoComplete="current-password"
                required
                label="Password"
                ref={passwordRef}
              />
            )}

            {user?.twoFactorEnabled && isCALIdentityProviver && (
              <Form handleSubmit={onConfirm} className="pb-4" form={form}>
                <TwoFactor center={false} />
              </Form>
            )}

            {hasDeleteErrors && <Alert severity="error" title={deleteErrorMessage} />}
            <DialogFooter>
              <Button
                color="primary"
                data-testid="delete-account-confirm"
                onClick={(e) => onConfirmButton(e)}>
                {t("delete_my_account")}
              </Button>
              <DialogClose />
            </DialogFooter>
          </>
        </DialogContent>
      </Dialog>

      {/* If changing email, confirm password */}
      <Dialog open={confirmPasswordOpen} onOpenChange={setConfirmPasswordOpen}>
        <DialogContent
          title={t("confirm_password")}
          description={t("confirm_password_change_email")}
          type="creation"
          Icon={FiAlertTriangle}>
          <>
            <PasswordField
              data-testid="password"
              name="password"
              id="password"
              autoComplete="current-password"
              required
              label="Password"
              ref={passwordRef}
            />

            {confirmPasswordErrorMessage && <Alert severity="error" title={confirmPasswordErrorMessage} />}
            <DialogFooter>
              <Button color="primary" onClick={(e) => onConfirmPassword(e)}>
                {t("confirm")}
              </Button>
              <DialogClose />
            </DialogFooter>
          </>
        </DialogContent>
      </Dialog>
    </>
  );
};

const ProfileForm = ({
  defaultValues,
  onSubmit,
  extraField,
}: {
  defaultValues: FormValues;
  onSubmit: (values: FormValues) => void;
  extraField?: React.ReactNode;
}) => {
  const { t } = useLocale();
  const [addEmailOpen, setAddEmailOpen] = useState(false);
  const [isNextStep, setIsNextStep] = useState<boolean>(false);
  const [emailList, setEmailList] = useState(defaultValues.emails || []);
  const [email, setEmail] = useState("");

  const profileFormSchema = z.object({
    username: z.string(),
    avatar: z.string(),
    name: z
      .string()
      .min(1)
      .max(FULL_NAME_LENGTH_MAX_LIMIT, {
        message: t("max_limit_allowed_hint", { limit: FULL_NAME_LENGTH_MAX_LIMIT }),
      }),
    email: z.string().email(),
    bio: z.string(),
    emails: z.array(
      z.object({
        email: z.string(),
        isPrimary: z.boolean().optional(),
        isVerified: z.boolean().optional(),
      })
    ),
  });

  const formMethods = useForm<FormValues>({
    defaultValues,
    resolver: zodResolver(profileFormSchema),
  });

  const {
    formState: { isSubmitting, isDirty },
  } = formMethods;

  const isDisabled = isSubmitting || !isDirty;

  const makePrimaryEmail = (email: Emails) => {
    setEmailList(
      emailList.map((emailmap) =>
        email.email === emailmap.email
          ? { ...emailmap, isPrimary: email.email === emailmap.email }
          : { ...emailmap, isPrimary: false }
      )
    );
    return formMethods.setValue(
      "emails",
      emailList.map((emailmap) =>
        email.email === emailmap.email
          ? { ...email, isPrimary: email.email === emailmap.email }
          : { ...emailmap, isPrimary: false }
      ),
      { shouldDirty: true }
    );
  };

  const deleteEmail = (email: Emails) => {
    setEmailList(emailList.filter((emailmap) => email.email !== emailmap.email));
    return formMethods.setValue(
      "emails",
      emailList.filter((emailmap) => email.email !== emailmap.email),
      { shouldDirty: true }
    );
  };

  useLayoutEffect(() => {
    if (emailList.length > 0) {
      formMethods.setValue("emails", emailList, { shouldDirty: true });
    }
  }, [formMethods, emailList]);

  return (
    <Form form={formMethods} handleSubmit={onSubmit}>
      <div className="flex items-center">
        <Controller
          control={formMethods.control}
          name="avatar"
          render={({ field: { value } }) => (
            <>
              <Avatar alt="" imageSrc={value} gravatarFallbackMd5="fallback" size="lg" />
              <div className="ms-4">
                <ImageUploader
                  target="avatar"
                  id="avatar-upload"
                  buttonMsg={t("change_avatar")}
                  handleAvatarChange={(newAvatar) => {
                    formMethods.setValue("avatar", newAvatar, { shouldDirty: true });
                  }}
                  imageSrc={value || undefined}
                />
              </div>
            </>
          )}
        />
      </div>
      {extraField}
      <div className="mt-8">
        <TextField label={t("full_name")} {...formMethods.register("name")} />
      </div>

      <div className="mt-8">
        <div className="mb-1">{t("email")}</div>
        {defaultValues.emails.length === 0 && <EmailListCard email={formMethods.getValues("email") || ""} />}
      </div>

      <div className="bg-default w-full sm:mx-0 xl:mt-0">
        {emailList.map((email) => (
          <EmailListCard
            email={email.email}
            key={email.email}
            isVerified={email.isVerified}
            isPrimary={email.isPrimary}
            actions={
              <Dropdown>
                <DropdownMenuTrigger asChild>
                  <Button
                    StartIcon={FiMoreHorizontal}
                    variant="icon"
                    className="!h-0 min-h-[30px] min-w-[30px] rounded-lg "
                    color="secondary"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>
                    <DropdownItem
                      type="button"
                      color="destructive"
                      disabled={email.isPrimary}
                      StartIcon={FiFlag}
                      onClick={() => {
                        makePrimaryEmail(email);
                      }}>
                      {t("Make Primary")}
                    </DropdownItem>

                    <DropdownItem
                      type="button"
                      color="destructive"
                      StartIcon={FiTrash}
                      disabled={email.isPrimary}
                      onClick={() => deleteEmail(email)}>
                      {t("delete")}
                    </DropdownItem>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </Dropdown>
            }
          />
        ))}
      </div>

      {/*Add More Email Addresses */}
      <Button StartIcon={FiPlus} className="mt-1" color="minimal" onClick={() => setAddEmailOpen(true)}>
        {t("add_email")}
      </Button>

      <Dialog open={addEmailOpen} onOpenChange={setAddEmailOpen}>
        {isNextStep ? (
          <DialogContent>
            <div className="grid grid-cols-[12%_88%]">
              <div className=" bg-emphasis flex h-10 w-10 items-center justify-center rounded-full  p-[6px]">
                <FiMail className="h-4 w-4" />
              </div>
              <DialogHeader title={t("confirm_email")} subtitle={t("email_confirmation", { email: email })} />
            </div>
            <DialogFooter>
              <Button
                color="primary"
                onClick={() => {
                  setAddEmailOpen(false);
                  setIsNextStep(false);
                  setEmail("");
                  setEmailList([...emailList, { email: email, isVerified: false, isPrimary: false }]);
                }}>
                {t("done")}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : (
          <DialogContent className="p-0">
            <div>
              <div className="px-8 pt-8 pb-2">
                <DialogHeader title={t("add_email")} subtitle={t("confirm_add_email")} />
                <TextField
                  label={t("email_address")}
                  placeholder="john.doe@example.com"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <hr className="border-subtle mt-4" />
              <div className="px-8 pb-7">
                <DialogFooter>
                  <DialogClose>{t("cancel")}</DialogClose>
                  <Button
                    color="primary"
                    onClick={() => {
                      setIsNextStep(true);
                    }}>
                    {t("add_email")}
                  </Button>
                </DialogFooter>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <div className="mt-8">
        <Label>{t("about")}</Label>
        <Editor
          getText={() => md.render(formMethods.getValues("bio") || "")}
          setText={(value: string) => {
            formMethods.setValue("bio", turndown(value), { shouldDirty: true });
          }}
          excludedToolbarItems={["blockType"]}
          disableLists
        />
      </div>
      <Button disabled={isDisabled} color="primary" className="mt-8" type="submit">
        {t("update")}
      </Button>
    </Form>
  );
};

ProfileView.getLayout = getLayout;

export default ProfileView;
