import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { genUserName } from "@/lib/genUserName";
import { useAuthor } from "@/hooks/useAuthor";
import { cn } from "@/lib/utils"

export interface ProfileAvatarProps {
  pubkey: string;
  size: "sm" | "md" | "lg";
  className?: string;
  shape?: "circle" | "square";
}

export function ProfileAvatar({ pubkey, size, className, shape = "circle" }: ProfileAvatarProps) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;

  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10"
  };

  const shapeClasses = {
    circle: "rounded-full",
    square: "rounded-md"
  };

  const displayName = metadata?.name || genUserName(pubkey);
  const profileImage = metadata?.picture;

  return (
    <div className={cn(
      "relative overflow-hidden", // Add overflow-hidden to prevent edge artifacts
      shapeClasses[shape],
      "bg-white border-2 border-white dark:border-gray-800", // Simplified border styling
      sizeClasses[size],
      className
    )}>
      <Avatar className={cn("w-full h-full rounded-full overflow-hidden", sizeClasses[size])}>
        <AvatarImage
          src={profileImage}
          alt={displayName}
          className="object-cover w-full h-full"
          onError={(e) => {
            // Fallback to initials if image fails to load
            const fallback = e.currentTarget.parentElement?.querySelector('.avatar-fallback');
            if (fallback) {
              (fallback as HTMLElement).style.display = 'flex';
              e.currentTarget.style.display = 'none';
            }
          }}
        />
        <AvatarFallback
          className={cn(
            "avatar-fallback bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold w-full h-full flex items-center justify-center",
            size === "sm" ? "text-xs" : "text-sm"
          )}
        >
          {displayName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full object-cover", className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
