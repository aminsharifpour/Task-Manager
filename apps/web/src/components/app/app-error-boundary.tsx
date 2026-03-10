import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  children: ReactNode;
  onErrorLog?: (payload: { message: string; stack: string; componentStack: string }) => void;
};

type State = {
  hasError: boolean;
  message: string;
};

export default class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: String(error?.message ?? "Unknown error") };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ui/runtime] uncaught render error:", error, errorInfo);
    this.props.onErrorLog?.({
      message: String(error?.message ?? ""),
      stack: String(error?.stack ?? ""),
      componentStack: String(errorInfo?.componentStack ?? ""),
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-4 py-8">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>خطای رابط کاربری</CardTitle>
            <CardDescription>یک خطای غیرمنتظره رخ داده است. لطفا صفحه را رفرش کنید.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="rounded-md border bg-muted p-2 text-xs text-muted-foreground">{this.state.message || "Unknown UI error"}</p>
            <Button type="button" onClick={() => window.location.reload()}>
              رفرش صفحه
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }
}
