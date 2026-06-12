'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Network,
  Video,
  HardDrive,
  Monitor,
  Server,
  Activity,
  Terminal,
  Cpu,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface InteractiveTopologyDiagramProps {
  config: {
    cameraCount?: number | string;
    systemType?: string;
    resolution?: string;
    storage?: string;
    premiseType?: string;
  };
}

interface NetworkNode {
  id: string;
  label: string;
  type: 'switch' | 'gateway' | 'storage' | 'terminal' | 'camera' | 'ellipsis';
  x: number;
  y: number;
  status: string;
  color: 'blue' | 'indigo' | 'emerald' | 'violet' | 'slate';
  icon: React.ComponentType<any>;
}

interface SystemLog {
  timestamp: string;
  text: string;
  type: 'SYS' | 'NET' | 'SEC';
}

// Sparkline Component for real-time visualization of telemetry data
function TelemetrySparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length === 0) return <div className="h-6 w-24 bg-white/5 animate-pulse rounded" />;
  
  const width = 120;
  const height = 24;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const points = data
    .map((val, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height + 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const strokeColor = 
    color === 'blue' ? '#2563eb' :
    color === 'indigo' ? '#818cf8' :
    color === 'emerald' ? '#34d399' :
    color === 'violet' ? '#c084fc' :
    '#94a3b8';

  const fillGradientId = `grad-${color}`;

  return (
    <svg className="w-[120px] h-[24px] overflow-visible" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.2" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Area Fill */}
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#${fillGradientId})`}
      />
      {/* Line path */}
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {/* Dynamic current point circle */}
      <circle
        cx={width}
        cy={height - ((data[data.length - 1] - min) / range) * height + 1}
        r="2"
        fill={strokeColor}
        className="animate-pulse"
      />
    </svg>
  );
}

export function InteractiveTopologyDiagram({ config }: InteractiveTopologyDiagramProps) {
  const [activeNodeId, setActiveNodeId] = useState<string>('switch');
  const [telemetryTick, setTelemetryTick] = useState<number>(0);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [logsList, setLogsList] = useState<SystemLog[]>([]);
  const [activeLogTab, setActiveLogTab] = useState<'ALL' | 'SYS' | 'NET' | 'SEC'>('ALL');
  const [sparklineHistory, setSparklineHistory] = useState<Record<string, number[]>>({});

  // SVG Coordinates system size
  const width = 600;
  const height = 420;

  useEffect(() => {
    setIsMounted(true);
    
    // Initialize sparkline histories with pre-filled baseline datasets
    const initialHistories: Record<string, number[]> = {};
    const nodesToInit = ['switch', 'gateway', 'storage', 'terminal', 'cam-more'];
    for (let i = 1; i <= 8; i++) {
      nodesToInit.push(`cam-${i}`);
    }
    
    nodesToInit.forEach(id => {
      initialHistories[id] = Array.from({ length: 15 }, () => 20 + Math.random() * 50);
    });
    setSparklineHistory(initialHistories);

    // Dynamic metrics fluctuation interval
    const telemetryInterval = setInterval(() => {
      setTelemetryTick((t) => t + 1);
      
      setSparklineHistory((prev) => {
        const updated = { ...prev };
        nodesToInit.forEach((id) => {
          const prevHistory = prev[id] || Array.from({ length: 15 }, () => 20 + Math.random() * 50);
          
          let newVal = 45;
          if (id === 'switch') {
            newVal = 20 + Math.sin(Date.now() / 2000) * 8 + Math.random() * 4 + 15;
          } else if (id === 'gateway') {
            newVal = 30 + Math.cos(Date.now() / 3000) * 15 + Math.random() * 10;
          } else if (id === 'storage') {
            newVal = 60 + Math.sin(Date.now() / 5000) * 5 + Math.random() * 3;
          } else if (id === 'terminal') {
            newVal = 10 + Math.random() * 4;
          } else if (id.startsWith('cam')) {
            newVal = 4 + Math.random() * 3;
          }
          
          updated[id] = [...prevHistory.slice(-14), newVal];
        });
        return updated;
      });
    }, 2000);

    // Rich structured console logs
    const logTemplates: { text: string; type: 'SYS' | 'NET' | 'SEC' }[] = [
      { text: 'WAN Uplink: 0.00% packet loss, link speed 1.0 Gbps (Fiber)', type: 'NET' },
      { text: 'Flushed segment buffers to RAID-5 block cache', type: 'SYS' },
      { text: 'Core Switch PoE temperature nominal: 42.1°C', type: 'SYS' },
      { text: 'Decryption engine key rotated successfully (AES-256 GCM)', type: 'SEC' },
      { text: 'PoE budget allocation balanced across ports', type: 'NET' },
      { text: 'Admin Console decoded stream: Nominal jitter (2ms)', type: 'SYS' },
      { text: 'RAID integrity check complete: 100% HEALTHY', type: 'SYS' },
      { text: 'Active camera optics focal auto-synchronization ok', type: 'SEC' },
      { text: 'Intrusion Detection System status: 0 anomalies', type: 'SEC' },
      { text: 'Port security protocols refreshed for endpoints', type: 'SEC' },
      { text: 'Continuous stream buffer commit to disk array nominal', type: 'SYS' },
      { text: 'Network routing tables optimized for local subnet traffic', type: 'NET' }
    ];

    const now = new Date();
    setLogsList([
      {
        timestamp: new Date(now.getTime() - 12000).toLocaleTimeString('en-US', { hour12: false }),
        text: 'DIAGNOSTIC ARCHITECTURE MAP LOADED',
        type: 'SYS'
      },
      {
        timestamp: new Date(now.getTime() - 8000).toLocaleTimeString('en-US', { hour12: false }),
        text: 'ESTABLISHED ENCRYPTED PORTS & WAN GATEWAY',
        type: 'NET'
      },
      {
        timestamp: new Date(now.getTime() - 4000).toLocaleTimeString('en-US', { hour12: false }),
        text: 'AES-256 SECURE MONITORING SERVICE RUNNING',
        type: 'SEC'
      }
    ]);

    const logsInterval = setInterval(() => {
      const template = logTemplates[Math.floor(Math.random() * logTemplates.length)];
      const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
      setLogsList((prev) => [
        ...prev.slice(-14),
        { timestamp, text: template.text, type: template.type }
      ]);
    }, 4000);

    return () => {
      clearInterval(telemetryInterval);
      clearInterval(logsInterval);
    };
  }, []);

  const cameraCount = Number(config.cameraCount) || 4;
  const visibleCameras = Math.min(cameraCount, 5);
  const showEllipsis = cameraCount > visibleCameras;

  // Switch node placement in coordinate layout
  const centralNode: NetworkNode = {
    id: 'switch',
    label: config.systemType === 'Analog' ? 'Central DVR Hub' : 'Core PoE Switch & NVR',
    type: 'switch',
    x: 300,
    y: 220,
    status: 'ACTIVE',
    color: 'blue',
    icon: Network,
  };

  // Peripheral standard nodes
  const extraNodes: NetworkNode[] = [
    {
      id: 'gateway',
      label: 'WAN Uplink Router',
      type: 'gateway',
      x: 100,
      y: 90,
      status: 'ONLINE',
      color: 'indigo',
      icon: Server,
    },
    {
      id: 'storage',
      label: 'RAID Array Storage',
      type: 'storage',
      x: 150,
      y: 330,
      status: 'WRITING',
      color: 'emerald',
      icon: HardDrive,
    },
    {
      id: 'terminal',
      label: 'Admin Station',
      type: 'terminal',
      x: 480,
      y: 330,
      status: 'CONNECTED',
      color: 'violet',
      icon: Monitor,
    },
  ];

  // Camera nodes computed in arc above switch center
  const cameraNodes: NetworkNode[] = [];
  for (let i = 0; i < visibleCameras; i++) {
    const minAngle = 195 * (Math.PI / 180);
    const maxAngle = 345 * (Math.PI / 180);
    const angle = visibleCameras === 1
      ? 270 * (Math.PI / 180)
      : minAngle + (i / (visibleCameras - 1)) * (maxAngle - minAngle);

    const rx = 185;
    const ry = 95;
    const cx = 300 + rx * Math.cos(angle);
    const cy = 220 + ry * Math.sin(angle);

    cameraNodes.push({
      id: `cam-${i + 1}`,
      label: `Node CAM-${String(i + 1).padStart(2, '0')}`,
      type: 'camera',
      x: cx,
      y: cy,
      status: 'ACTIVE',
      color: 'blue',
      icon: Video,
    });
  }

  // Ellipsis nodes for remaining cameras counts
  if (showEllipsis) {
    const angle = 355 * (Math.PI / 180);
    const rx = 185;
    const ry = 95;
    const cx = 300 + rx * Math.cos(angle);
    const cy = 220 + ry * Math.sin(angle);

    cameraNodes.push({
      id: 'cam-more',
      label: `+${cameraCount - visibleCameras} More Nodes`,
      type: 'ellipsis',
      x: cx,
      y: cy,
      status: 'NOMINAL',
      color: 'slate',
      icon: Network,
    });
  }

  const allNodes = [centralNode, ...extraNodes, ...cameraNodes];
  const selectedNode = allNodes.find((n) => n.id === activeNodeId) || centralNode;

  // Fluctuated telemetry outputs helper
  const getFluctuatedVal = (base: number, range: number, decimals = 1) => {
    if (!isMounted) return base.toFixed(decimals);
    const wave = Math.sin(telemetryTick * 0.8) * Math.cos(telemetryTick * 0.3);
    return (base + wave * range).toFixed(decimals);
  };

  const getTelemetryData = (node: NetworkNode) => {
    const res = config.resolution || '4K';
    const retention = config.storage || '30 Days';

    switch (node.id) {
      case 'switch':
        return [
          { key: 'Device Type', val: config.systemType === 'Analog' ? 'Turbo-HD DVR' : 'Smart Managed NVR' },
          { key: 'IP Address', val: '192.168.1.100' },
          { key: 'Core CPU Load', val: `${getFluctuatedVal(28.4, 3.5)}%`, sparkType: 'switch' },
          { key: 'Core Temp', val: `${getFluctuatedVal(42.1, 1.8)}°C` },
          { key: 'Aggregate Load', val: `${getFluctuatedVal(32.4, 2.1)} Mbps` },
          { key: 'PoE Allocation', val: `${getFluctuatedVal(36.8, 0.4)}W / 120W` },
          { key: 'System Uptime', val: '12d 14h 32m' },
        ];
      case 'gateway':
        return [
          { key: 'Model', val: 'WAN Gateway Pro' },
          { key: 'Public WAN IP', val: '103.88.24.19' },
          { key: 'Uplink Link', val: '1.0 Gbps (Fiber)', sparkType: 'gateway' },
          { key: 'Tunnel Encryption', val: 'AES-256 (IPSec)' },
          { key: 'Security Audit', val: 'IPS Shield Active' },
          { key: 'Packet Drop', val: '0.00% nominal' },
        ];
      case 'storage':
        return [
          { key: 'Format', val: 'Surveillance RAID-5' },
          { key: 'Active Arrays', val: '4x Enterprise HDD' },
          { key: 'Occupied Storage', val: `11.4 TB / 16.0 TB (71%)` },
          { key: 'Disk Write Load', val: `${getFluctuatedVal(63.2, 2.8)}%`, sparkType: 'storage' },
          { key: 'SLA Retention', val: retention },
          { key: 'Smart Integrity', val: '100% HEALTHY' },
        ];
      case 'terminal':
        return [
          { key: 'Client ID', val: 'ADMIN-CONSOLE-01' },
          { key: 'OS / Browser', val: 'TecOS Web Console' },
          { key: 'Stream Decoding', val: 'WebGL Accelerated' },
          { key: 'Active Grid View', val: 'Multi-Channel H.265' },
          { key: 'Console Latency', val: `${getFluctuatedVal(12, 1.5, 0)}ms`, sparkType: 'terminal' },
          { key: 'Port Integrity', val: 'Secure HTTPS (TLS 1.3)' },
        ];
      case 'cam-more':
        return [
          { key: 'Aggregate Nodes', val: `${cameraCount - visibleCameras} background channels` },
          { key: 'Combined Stream', val: `${getFluctuatedVal(24.2, 1.8)} Mbps`, sparkType: 'cam-more' },
          { key: 'Connection Mode', val: 'Aux Switch / Port Splitting' },
          { key: 'Diagnostics Code', val: 'CODE: 200 (ONLINE)' },
          { key: 'Compliance Grade', val: 'Tier-1 Certified' },
        ];
      default:
        return [
          { key: 'Sensor Model', val: `TecGuard 4K ${config.systemType === 'Analog' ? 'Analog-HD' : 'IP Bullet'}` },
          { key: 'Resolution Target', val: res },
          { key: 'Output Stream', val: `${getFluctuatedVal(6.2, 0.4)} Mbps` },
          { key: 'Sensor Latency', val: `${getFluctuatedVal(4.2, 0.8)}ms`, sparkType: node.id },
          { key: 'PoE Budget Draw', val: '4.8W [Class 2]' },
          { key: 'Optics Focal', val: '2.8mm @ F1.6' },
        ];
    }
  };

  const activeTelemetry = getTelemetryData(selectedNode);

  // Filter logs list based on tab
  const filteredLogs = logsList.filter(log => activeLogTab === 'ALL' || log.type === activeLogTab);

  // Keyboard navigation for accessible layout selection
  const handleKeyDown = (e: React.KeyboardEvent, currentNodeIndex: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (currentNodeIndex + 1) % allNodes.length;
      setActiveNodeId(allNodes[nextIndex].id);
      document.getElementById(`node-btn-${allNodes[nextIndex].id}`)?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (currentNodeIndex - 1 + allNodes.length) % allNodes.length;
      setActiveNodeId(allNodes[prevIndex].id);
      document.getElementById(`node-btn-${allNodes[prevIndex].id}`)?.focus();
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card/40 p-4 sm:p-6 backdrop-blur-xl relative overflow-hidden transition-all duration-300">
      {/* Glow Filter & Keyframe styling */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes topology-dash-flow {
          to {
            stroke-dashoffset: -24;
          }
        }
        .animate-topology-dash {
          stroke-dasharray: 6 6;
          animation: topology-dash-flow 1.5s linear infinite;
        }
        @keyframes radar-scan {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-radar-scan {
          animation: radar-scan 12s linear infinite;
        }
      ` }} />

      {/* Top Banner / System Console Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-border pb-4 mb-6 gap-3">
        <div>
          <span className="text-[10px] font-bold text-primary font-mono tracking-widest uppercase flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            SEC-NET SYSTEM MONITOR v2.0.0
          </span>
          <h2 className="text-foreground text-lg font-bold tracking-tight mt-1">
            {config.premiseType || 'Premise'} Network Architecture Map
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <Activity className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
          <span>Active Connections: {cameraCount + 3} Devices</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Side: Interactive Network Visualizer */}
        <div className="lg:col-span-3 bg-muted/30 rounded-2xl border border-border p-4 relative min-h-[360px] flex items-center justify-center overflow-hidden aspect-[4/3] max-w-full group">
          {/* Futuristic Grid Background Pattern */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.05] bg-[radial-gradient(#2563eb_1px,transparent_1px)] [background-size:16px_16px]" />
          
          {/* Subtle concentric grid lines in background */}
          <div className="absolute h-[340px] w-[340px] rounded-full border border-primary/5 pointer-events-none flex items-center justify-center">
            <div className="h-[220px] w-[220px] rounded-full border border-primary/5 flex items-center justify-center">
              <div className="h-[100px] w-[100px] rounded-full border border-primary/5" />
            </div>
          </div>

          {/* SVG Connection Paths & Targets */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <filter id="svg-glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            {/* Target Crosshairs Traced on Selected Node */}
            <line
              x1="0"
              y1={selectedNode.y}
              x2={width}
              y2={selectedNode.y}
              className="stroke-primary/10 stroke-[0.5] stroke-dasharray-[2_4] transition-all duration-300"
            />
            <line
              x1={selectedNode.x}
              y1="0"
              x2={selectedNode.x}
              y2={height}
              className="stroke-primary/10 stroke-[0.5] stroke-dasharray-[2_4] transition-all duration-300"
            />

            {/* Central Switch Concentric Scanning Ring */}
            <circle
              cx={centralNode.x}
              cy={centralNode.y}
              r="35"
              className="stroke-primary/10 fill-none stroke-[1.5] stroke-dasharray-[4_8] animate-radar-scan origin-center"
              style={{ transformOrigin: `${centralNode.x}px ${centralNode.y}px` }}
            />

            {/* Connector Lines */}
            {allNodes.map((node) => {
              if (node.id === 'switch') return null;
              
              const isSpecificActive = activeNodeId === node.id;
              const isSharedActive = activeNodeId === 'switch' || isSpecificActive;

              let strokeColor = 'rgba(71, 85, 105, 0.2)'; // slate-600/20
              let activeStroke = 'rgba(37, 99, 235, 0.4)'; // blue-400/40
              
              if (node.color === 'indigo') {
                activeStroke = 'rgba(129, 140, 248, 0.5)';
              } else if (node.color === 'emerald') {
                activeStroke = 'rgba(52, 211, 153, 0.5)';
              } else if (node.color === 'violet') {
                activeStroke = 'rgba(192, 132, 252, 0.5)';
              }

              return (
                <g key={`link-${node.id}`}>
                  {/* Outer glow aura path when active */}
                  {isSpecificActive && (
                    <line
                      x1={node.x}
                      y1={node.y}
                      x2={centralNode.x}
                      y2={centralNode.y}
                      className="stroke-[3] opacity-40"
                      stroke={node.color === 'blue' ? '#2563eb' : node.color === 'indigo' ? '#818cf8' : node.color === 'emerald' ? '#34d399' : node.color === 'violet' ? '#c084fc' : '#94a3b8'}
                      filter="url(#svg-glow)"
                    />
                  )}
                  {/* Core connection link */}
                  <line
                    x1={node.x}
                    y1={node.y}
                    x2={centralNode.x}
                    y2={centralNode.y}
                    className={cn(
                      "transition-all duration-300",
                      isSpecificActive ? "stroke-[2]" : "stroke-[1]"
                    )}
                    stroke={isSpecificActive ? (node.color === 'blue' ? '#2563eb' : node.color === 'indigo' ? '#818cf8' : node.color === 'emerald' ? '#34d399' : node.color === 'violet' ? '#c084fc' : '#94a3b8') : isSharedActive ? 'rgba(71, 85, 105, 0.4)' : 'rgba(51, 65, 85, 0.15)'}
                  />
                  {/* Moving Packets Overlay */}
                  <line
                    x1={node.x}
                    y1={node.y}
                    x2={centralNode.x}
                    y2={centralNode.y}
                    className={cn(
                      "animate-topology-dash transition-all duration-300 stroke-[1.5]",
                      isSpecificActive ? "opacity-100" : "opacity-40"
                    )}
                    stroke={activeStroke}
                  />
                </g>
              );
            })}
          </svg>

          {/* HTML Interactive Nodes overlaid on coordinates */}
          {allNodes.map((node, index) => {
            const Icon = node.icon;
            const isSelected = activeNodeId === node.id;

            return (
              <button
                key={node.id}
                id={`node-btn-${node.id}`}
                onClick={() => setActiveNodeId(node.id)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                role="tab"
                aria-selected={isSelected}
                aria-controls="device-inspector-panel"
                className={cn(
                  "absolute flex flex-col items-center justify-center group focus:outline-none transition-all duration-300 select-none",
                  isSelected ? "scale-110 z-20" : "hover:scale-105 z-10"
                )}
                style={{
                  left: `${(node.x / width) * 100}%`,
                  top: `${(node.y / height) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                aria-label={`Inspect ${node.label}`}
              >
                {/* Node Box with Cyber HUD corner brackets */}
                <div
                  className={cn(
                    "h-12 w-12 rounded-xl flex items-center justify-center border transition-all duration-300 relative bg-card",
                    
                    // Selected glow state configurations
                    isSelected && node.color === 'blue' && "border-primary shadow-[0_0_15px_rgba(37,99,235,0.25)] text-primary",
                    isSelected && node.color === 'indigo' && "border-indigo-400 shadow-[0_0_15px_rgba(129,140,248,0.25)] text-indigo-400",
                    isSelected && node.color === 'emerald' && "border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.25)] text-emerald-400",
                    isSelected && node.color === 'violet' && "border-violet-400 shadow-[0_0_15px_rgba(192,132,252,0.25)] text-violet-400",
                    isSelected && node.color === 'slate' && "border-slate-400 shadow-[0_0_15px_rgba(148,163,184,0.25)] text-slate-300",
                    
                    // Default states
                    !isSelected && "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                  )}
                >
                  <Icon className={cn(
                    "h-5 w-5 transition-transform duration-300 group-hover:scale-110",
                    isSelected ? "animate-pulse" : ""
                  )} />

                  {/* Corner Accent Brackets on hover/selection */}
                  {(isSelected || hoverCheck) && (
                    <>
                      <div className={cn("absolute top-[-2px] left-[-2px] w-2 h-2 border-t-2 border-l-2 rounded-tl-[3px]",
                        node.color === 'blue' && "border-primary",
                        node.color === 'indigo' && "border-indigo-400",
                        node.color === 'emerald' && "border-emerald-400",
                        node.color === 'violet' && "border-violet-400",
                        node.color === 'slate' && "border-slate-400"
                      )} />
                      <div className={cn("absolute top-[-2px] right-[-2px] w-2 h-2 border-t-2 border-r-2 rounded-tr-[3px]",
                        node.color === 'blue' && "border-primary",
                        node.color === 'indigo' && "border-indigo-400",
                        node.color === 'emerald' && "border-emerald-400",
                        node.color === 'violet' && "border-violet-400",
                        node.color === 'slate' && "border-slate-400"
                      )} />
                      <div className={cn("absolute bottom-[-2px] left-[-2px] w-2 h-2 border-b-2 border-l-2 rounded-bl-[3px]",
                        node.color === 'blue' && "border-primary",
                        node.color === 'indigo' && "border-indigo-400",
                        node.color === 'emerald' && "border-emerald-400",
                        node.color === 'violet' && "border-violet-400",
                        node.color === 'slate' && "border-slate-400"
                      )} />
                      <div className={cn("absolute bottom-[-2px] right-[-2px] w-2 h-2 border-b-2 border-r-2 rounded-br-[3px]",
                        node.color === 'blue' && "border-primary",
                        node.color === 'indigo' && "border-indigo-400",
                        node.color === 'emerald' && "border-emerald-400",
                        node.color === 'violet' && "border-violet-400",
                        node.color === 'slate' && "border-slate-400"
                      )} />
                    </>
                  )}

                  {/* Pulsing indicator dot on selection */}
                  {isSelected && (
                    <span className={cn(
                      "absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border border-background flex items-center justify-center",
                      node.color === 'blue' && "bg-primary",
                      node.color === 'indigo' && "bg-indigo-400",
                      node.color === 'emerald' && "bg-emerald-400",
                      node.color === 'violet' && "bg-violet-400",
                      node.color === 'slate' && "bg-slate-400"
                    )}>
                      <span className={cn(
                        "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                        node.color === 'blue' && "bg-primary",
                        node.color === 'indigo' && "bg-indigo-400",
                        node.color === 'emerald' && "bg-emerald-400",
                        node.color === 'violet' && "bg-violet-400",
                        node.color === 'slate' && "bg-slate-400"
                      )} />
                    </span>
                  )}
                </div>

                {/* Node tag tooltip below node */}
                <span className={cn(
                  "mt-2 text-[9px] font-bold uppercase font-mono tracking-wider px-1.5 py-0.5 rounded border transition-all duration-300 pointer-events-none select-none",
                  isSelected
                    ? "text-foreground bg-muted border-border shadow-md"
                    : "text-muted-foreground bg-muted/40 border-transparent group-hover:text-foreground group-hover:bg-muted/80 group-hover:border-border"
                )}>
                  {node.id === 'switch' ? 'CORE SWITCH' : node.label.replace('Node ', '')}
                </span>

                {/* Coordinate marker displayed only on selected node */}
                {isSelected && (
                  <span className="absolute -bottom-8 text-[8px] font-mono text-primary/70 tracking-widest bg-background/80 px-1 border border-primary/20 rounded-md">
                    X:{Math.round(node.x)} Y:{Math.round(node.y)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Side: High-Tech Monospace Console Inspector */}
        <div 
          id="device-inspector-panel"
          role="tabpanel"
          aria-label="Component Telemetry Details"
          className="lg:col-span-2 flex flex-col justify-between bg-card border border-border rounded-2xl p-4 sm:p-5 font-mono text-xs text-card-foreground min-h-[380px] shadow-2xl relative"
        >
          {/* Telemetry Header */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="font-bold text-primary flex items-center gap-1.5 uppercase">
                <Terminal className="h-3.5 w-3.5" />
                DEVICE INSPECTOR
              </span>
              <span className={cn(
                "px-2 py-0.5 rounded-[4px] text-[10px] font-bold tracking-wider",
                selectedNode.status === 'ACTIVE' || selectedNode.status === 'ONLINE' || selectedNode.status === 'CONNECTED'
                  ? "bg-emerald-900/10 text-emerald-500 border border-emerald-900/30"
                  : selectedNode.status === 'WRITING'
                    ? "bg-primary/10 text-primary border border-primary/30 animate-pulse"
                    : "bg-muted text-muted-foreground"
              )}>
                {selectedNode.status}
              </span>
            </div>

            {/* Selected Node Header */}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Selected Component</p>
              <h3 className="text-foreground text-sm font-bold tracking-tight mt-0.5">{selectedNode.label}</h3>
              <p className="text-[9px] text-muted-foreground/85 font-mono mt-0.5">MAC_ID: 00:1A:2B:3C:{(selectedNode.id.charCodeAt(0) || 48).toString(16)}D:{ (selectedNode.id.charCodeAt(selectedNode.id.length - 1) || 57).toString(16) }</p>
            </div>

            {/* Key-Value Telemetry Listing */}
            <div className="space-y-2.5 pt-2 border-t border-border">
              {activeTelemetry.map((item) => (
                <div key={item.key} className="flex flex-col gap-1.5 group">
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-muted-foreground group-hover:text-muted-foreground/80 transition-colors">{item.key}</span>
                    <span className="text-right font-semibold font-mono tracking-wide text-foreground">
                      {item.val}
                    </span>
                  </div>

                  {/* Render sparkline if item has sparkType defined */}
                  {item.sparkType && sparklineHistory[item.sparkType] && (
                    <div className="flex justify-end pt-1 pb-1">
                      <TelemetrySparkline 
                        data={sparklineHistory[item.sparkType]} 
                        color={selectedNode.color}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Dynamic Console Scroll Feed */}
          <div className="mt-6 pt-4 border-t border-border flex flex-col justify-end gap-1.5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">Live Console Feed</p>
              {/* Category tabs filters */}
              <div className="flex gap-1.5 text-[8px] font-bold">
                {(['ALL', 'SYS', 'NET', 'SEC'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveLogTab(tab)}
                    className={cn(
                      "px-1 py-0.5 rounded transition-all",
                      activeLogTab === tab 
                        ? "bg-primary/20 text-primary border border-primary/20"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-muted/30 border border-border p-2 rounded-lg max-h-[85px] overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {filteredLogs.length === 0 ? (
                <div className="text-[9px] text-muted-foreground italic">No logs found in {activeLogTab} filter...</div>
              ) : (
                filteredLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className="text-[9px] font-mono leading-relaxed flex items-start gap-1.5"
                  >
                    <span className="text-muted-foreground">[{log.timestamp}]</span>
                    <span className={cn(
                      "font-bold text-[8px] px-1 py-0.2 rounded-[3px]",
                      log.type === 'SYS' && "bg-emerald-500/10 text-emerald-500 border border-emerald-900/30",
                      log.type === 'NET' && "bg-primary/10 text-primary border border-primary/30",
                      log.type === 'SEC' && "bg-violet-500/10 text-violet-500 border border-violet-900/30"
                    )}>
                      {log.type}
                    </span>
                    <span className={cn(
                      "flex-1",
                      idx === filteredLogs.length - 1 ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {log.text}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="text-[9px] text-primary/60 font-mono animate-pulse mt-1 flex items-center gap-1.5">
              <span>&gt; SOCKET MONITOR ONLINE</span>
              <span className="h-1 w-1 bg-primary rounded-full animate-ping" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Dummy check to avoid TS error on hover variables
const hoverCheck = false;
