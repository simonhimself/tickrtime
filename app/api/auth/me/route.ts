import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "No authorization token provided" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    
    // Verify the token
    const userData = await verifyToken(token);
    if (!userData) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Return user data
    return NextResponse.json({
      user: {
        id: userData.userId,
        email: userData.email,
        emailVerified: userData.emailVerified,
      }
    });
  } catch (error) {
    console.error("Error verifying auth:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 401 }
    );
  }
}