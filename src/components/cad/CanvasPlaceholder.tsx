import { Component, ErrorInfo, ReactNode } from "react";
import { OpenCascadeViewport } from "./OpenCascadeViewport.tsx";
import { Stack, Box, Title, Text, Code } from "@mantine/core";
import type { CADProject } from "@/types/cad";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Stack
          align="center"
          justify="center"
          style={{
            height: '100%',
            width: '100%',
            backgroundColor: 'hsl(0, 85%, 60%, 0.1)',
            padding: 32,
          }}
        >
          <Box
            style={{
              maxWidth: 672,
              borderRadius: 8,
              border: '1px solid hsl(0, 85%, 60%)',
              backgroundColor: 'hsl(230, 22%, 11%)',
              padding: 24,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            }}
          >
            <Title order={2} c="red.5" mb="md">
              Component Error
            </Title>
            <Box mb="md">
              <Text fw={600} mb="xs">Error Message:</Text>
              <Code
                block
                style={{
                  overflow: 'auto',
                  fontSize: 12,
                  padding: 12,
                }}
              >
                {this.state.error?.toString()}
              </Code>
            </Box>
            <Box mb="md">
              <Text fw={600} mb="xs">Error Stack:</Text>
              <Code
                block
                style={{
                  maxHeight: 256,
                  overflow: 'auto',
                  fontSize: 12,
                  padding: 12,
                }}
              >
                {this.state.error?.stack}
              </Code>
            </Box>
            <Box>
              <Text fw={600} mb="xs">Component Stack:</Text>
              <Code
                block
                style={{
                  maxHeight: 256,
                  overflow: 'auto',
                  fontSize: 12,
                  padding: 12,
                }}
              >
                {this.state.errorInfo?.componentStack}
              </Code>
            </Box>
          </Box>
        </Stack>
      );
    }

    return this.props.children;
  }
}

interface CanvasPlaceholderProps {
  project?: CADProject;
  showDemo?: boolean;
}

export function CanvasPlaceholder({ project, showDemo }: CanvasPlaceholderProps) {
  return (
    <ErrorBoundary>
      <OpenCascadeViewport project={project} showDemo={showDemo} />
    </ErrorBoundary>
  );
}
