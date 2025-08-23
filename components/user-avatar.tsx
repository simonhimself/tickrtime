"use client";

import { useRouter } from "next/navigation";
import { User2, LogOut } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserAvatarProps {
  email: string;
  onLogout: () => void;
}

export function UserAvatar({ email, onLogout }: UserAvatarProps) {
  const router = useRouter();

  // Generate initials from email (take first two characters of email before @)
  const getInitials = (email: string): string => {
    const localPart = email.split("@")[0];
    if (!localPart) return "U";
    
    if (localPart.includes(".")) {
      // If email has a dot (like john.doe@), take first letter of each part
      const parts = localPart.split(".");
      return parts
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() || "")
        .join("") || "U";
    } else {
      // Otherwise take first two characters
      return localPart.slice(0, 2).toUpperCase() || "U";
    }
  };

  const initials = getInitials(email);

  const handleProfileClick = () => {
    router.push("/profile");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-7 w-7 sm:h-8 sm:w-8 rounded-full p-0 hover:bg-transparent focus-visible:ring-2 focus-visible:ring-offset-2"
          aria-label="User menu"
        >
          <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
            <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm text-muted-foreground truncate">{email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={handleProfileClick}
          className="cursor-pointer"
        >
          <User2 className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={onLogout}
          className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}