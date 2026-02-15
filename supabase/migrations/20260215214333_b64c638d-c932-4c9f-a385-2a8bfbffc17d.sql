
-- Drop the overly permissive INSERT policy
DROP POLICY "System can insert notifications" ON public.notifications;

-- Admins can insert notifications for their org technicians
CREATE POLICY "Admins can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Delete policy for users to clear their own notifications
CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);
