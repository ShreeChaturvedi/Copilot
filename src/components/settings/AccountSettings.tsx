import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Camera, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CursorTooltip } from '@/components/ui/CursorTooltip';
import {
  useProfileData,
  useProfileFormData,
  TIMEZONE_OPTIONS,
} from '@/hooks/useProfileData';
import { useAuthStore } from '@/stores/authStore';
import { userAPI } from '@/services/api/user';

const profileFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  timezone: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const DEBOUNCE_MS = 600;

export function AccountSettings() {
  const [saving, setSaving] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  const profileData = useProfileData();
  const formData = useProfileFormData();
  const { authMethod, updateUser } = useAuthStore();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValues = useRef<ProfileFormValues | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: formData.name,
      bio: formData.bio,
      timezone: formData.timezone,
    },
    mode: 'onChange',
  });

  // Keep form in sync if profile rehydrates from outside.
  useEffect(() => {
    form.reset({
      name: formData.name,
      bio: formData.bio,
      timezone: formData.timezone,
    });
  }, [formData.name, formData.bio, formData.timezone, form]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const persist = useCallback(
    async (data: ProfileFormValues) => {
      try {
        setSaving(true);
        setUpdateError(null);
        setUpdateSuccess(false);

        const updated = await userAPI.updateProfile({
          name: data.name,
          bio: data.bio ?? null,
          timezone: data.timezone || undefined,
        });

        updateUser({
          name: updated.name ?? data.name,
          bio: updated.profile.bio ?? undefined,
          timezone: updated.profile.timezone,
          picture: updated.profile.avatarUrl ?? undefined,
          googleId: updated.googleId,
        });

        form.reset({
          name: updated.name ?? data.name,
          bio: updated.profile.bio ?? '',
          timezone: updated.profile.timezone ?? '',
        });

        setUpdateSuccess(true);
        setTimeout(() => setUpdateSuccess(false), 2000);
      } catch (error) {
        setUpdateError(
          error instanceof Error ? error.message : 'Failed to update profile'
        );
      } finally {
        setSaving(false);
      }
    },
    [form, updateUser]
  );

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void form.handleSubmit(async (data) => {
        if (!form.formState.isDirty) return;
        latestValues.current = data;
        await persist(data);
      })();
    }, DEBOUNCE_MS);
  }, [form, persist]);

  const flushSave = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    void form.handleSubmit(async (data) => {
      if (!form.formState.isDirty) return;
      await persist(data);
    })();
  }, [form, persist]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const fieldClass = 'h-8 text-[13px]';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 border-b border-hairline pb-4">
        <Avatar className="size-10 shrink-0">
          <AvatarImage src={profileData.picture} alt={profileData.name} />
          <AvatarFallback className="text-xs font-medium">
            {getInitials(profileData.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[13px] text-foreground truncate leading-tight">
            {profileData.name}
          </p>
          <p className="text-[12px] text-ink-muted truncate leading-tight mt-0.5">
            {profileData.email}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge
              variant={authMethod === 'google' ? 'secondary' : 'outline'}
              className="text-[10px] h-5 px-1.5"
            >
              {authMethod === 'google' ? 'Google' : 'Local'}
            </Badge>
            {saving && (
              <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
                <Loader2 className="size-3 animate-spin" />
                Saving
              </span>
            )}
            {updateSuccess && !saving && (
              <span className="text-[11px] text-success">Saved</span>
            )}
          </div>
        </div>
        <CursorTooltip content="Avatar upload isn't available yet">
          <Button
            variant="outline"
            size="sm"
            disabled
            className="shrink-0 h-7 text-[12px]"
          >
            <Camera className="size-3.5 mr-1.5" />
            Photo
          </Button>
        </CursorTooltip>
      </div>

      <Form {...(form as unknown as import('react-hook-form').UseFormReturn)}>
        <form
          className="space-y-3.5 max-w-sm"
          onSubmit={(e) => e.preventDefault()}
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-[12px] text-ink-muted font-medium">
                  Display name
                </FormLabel>
                <FormControl>
                  <Input
                    className={fieldClass}
                    placeholder="Your name"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      scheduleSave();
                    }}
                    onBlur={() => {
                      field.onBlur();
                      flushSave();
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-1.5">
            <FormLabel className="text-[12px] text-ink-muted font-medium">
              Email
            </FormLabel>
            <Input
              className={fieldClass}
              type="email"
              value={profileData.email}
              readOnly
              disabled
            />
            <p className="text-[11px] text-ink-muted">
              {profileData.canEditEmail
                ? 'Email cannot be changed here.'
                : 'Managed by your Google account.'}
            </p>
          </div>

          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-[12px] text-ink-muted font-medium">
                  Bio
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="A short line about you"
                    className="resize-none text-[13px] min-h-[4.5rem]"
                    rows={2}
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      scheduleSave();
                    }}
                    onBlur={() => {
                      field.onBlur();
                      flushSave();
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="timezone"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-[12px] text-ink-muted font-medium">
                  Timezone
                </FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    form.setValue('timezone', v, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    void persist({
                      ...form.getValues(),
                      timezone: v,
                    });
                  }}
                >
                  <FormControl>
                    <SelectTrigger className={fieldClass + ' w-full'}>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {updateError && (
            <Alert variant="destructive">
              <AlertDescription>{updateError}</AlertDescription>
            </Alert>
          )}
        </form>
      </Form>
    </div>
  );
}

/** @deprecated Use AccountSettings — kept name alias for any stray imports. */
export { AccountSettings as ProfileSettings };
