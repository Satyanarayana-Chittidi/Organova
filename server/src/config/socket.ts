import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyToken, AUTH_COOKIE_NAME } from '../utils/jwt';
import { findHubByUserId } from '../models/hubModel';
import pool from './database';
import { JWTPayload } from '../types/auth';

let io: SocketIOServer | null = null;

// Extend socket data interface with our authenticated user session
export interface AuthenticatedSocket extends Socket {
  data: {
    user?: JWTPayload;
    hubId?: number;
    bloodGroup?: string;
    city?: string;
  };
}

/**
 * Initializes the Socket.IO WebSocket server with CORS and JWT authentication.
 */
export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Authentication Handshake Middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      let token = socket.handshake.auth?.token;

      // Fallback: extract from cookie header
      if (!token && socket.handshake.headers.cookie) {
        const cookies = socket.handshake.headers.cookie.split(';');
        for (const cookie of cookies) {
          const [key, value] = cookie.trim().split('=');
          if (key === AUTH_COOKIE_NAME) {
            token = decodeURIComponent(value);
            break;
          }
        }
      }

      if (!token) {
        return next(new Error('Authentication error: No session token provided in handshake.'));
      }

      const decoded = verifyToken(token);
      socket.data.user = decoded;

      // If the user belongs to an institutional facility, join their hub room
      if (decoded.role === 'HOSPITAL') {
        const hub = await findHubByUserId(decoded.userId);
        if (hub) {
          socket.data.hubId = hub.id;
        }
      } else if (decoded.role === 'USER') {
        const [profiles]: any = await pool.query(
          'SELECT blood_group, city FROM citizen_profiles WHERE user_id = ? LIMIT 1',
          [decoded.userId]
        );
        if (profiles && profiles.length > 0) {
          socket.data.bloodGroup = profiles[0].blood_group;
          socket.data.city = profiles[0].city;
        }
      }

      next();
    } catch (error: any) {
      next(new Error('Authentication error: Invalid or expired session token.'));
    }
  });

  // Client Connection & Room Subscriptions
  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.data.user!;
    console.log(`[WEBSOCKET] Client connected: Socket ID ${socket.id} (User: ${user.email}, Role: ${user.role})`);

    // 1. Join user-specific personal room
    socket.join(`user:${user.userId}`);

    // 2. Join role-specific broadcast room
    socket.join(`role:${user.role}`);

    // 3. Join facility room if applicable
    if (socket.data.hubId) {
      socket.join(`hub:${socket.data.hubId}`);
      console.log(`[WEBSOCKET] Socket joined facility room: hub:${socket.data.hubId}`);
    }

    // 4. Join blood group room if citizen donor
    if (socket.data.bloodGroup) {
      socket.join(`blood:${socket.data.bloodGroup}`);
      console.log(`[WEBSOCKET] Citizen joined blood donor room: blood:${socket.data.bloodGroup}`);
    }

    socket.on('disconnect', (reason) => {
      console.log(`[WEBSOCKET] Client disconnected: Socket ID ${socket.id} (Reason: ${reason})`);
    });
  });

  console.log('[WEBSOCKET] Real-time Socket.IO server initialized successfully.');
  return io;
}

/**
 * Returns the singleton Socket.IO instance.
 */
export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO has not been initialized. Call initSocketServer() first.');
  }
  return io;
}

// ====================================================================
// REAL-TIME EVENT EMISSION DISPATCHERS
// ====================================================================

/**
 * Dispatches live notification when an organ match offer is proposed.
 */
export function emitMatchOfferProposed(payload: {
  matchId: number;
  organName: string;
  bloodGroup: string;
  score: number;
  recipientUserId: string;
  attendingHubId: number;
  responseDeadline: string;
}): void {
  if (!io) return;

  // 1. Alert attending surgical team room
  io.to(`hub:${payload.attendingHubId}`).emit('MATCH_OFFER_RECEIVED', {
    type: 'ORGAN_MATCH_OFFER',
    priority: 'HIGH_URGENCY',
    message: `URGENT: Donor ${payload.organName} (${payload.bloodGroup}) matched! 20-minute review window started.`,
    matchId: payload.matchId,
    score: payload.score,
    responseDeadline: payload.responseDeadline,
    timestamp: new Date().toISOString(),
  });

  // 2. Alert recipient patient passport room
  io.to(`user:${payload.recipientUserId}`).emit('RECIPIENT_MATCH_ALERT', {
    type: 'MATCH_OFFERED',
    message: `A compatible donor ${payload.organName} has been identified. Your surgical team is reviewing the offer.`,
    timestamp: new Date().toISOString(),
  });

  // 3. Alert platform administrators
  io.to('role:ADMIN').emit('ADMIN_AUDIT_LOG', {
    event: 'ORGAN_MATCH_PROPOSED',
    matchId: payload.matchId,
    attendingHubId: payload.attendingHubId,
    score: payload.score,
  });
}

/**
 * Dispatches notification when a match offer is accepted.
 */
export function emitMatchOfferAccepted(payload: {
  matchId: number;
  organId: number;
  organName: string;
  donorHubId: number;
  attendingHubId: number;
}): void {
  if (!io) return;

  // Alert donor harvesting facility
  io.to(`hub:${payload.donorHubId}`).emit('MATCH_ALLOCATED', {
    type: 'ORGAN_ALLOCATED',
    message: `Offer accepted! ${payload.organName} allocated for transplant. Prepare cold preservation for dispatch.`,
    matchId: payload.matchId,
    organId: payload.organId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Dispatches real-time broadcast when an emergency blood requisition is registered.
 */
export function emitEmergencyBloodRequest(payload: {
  requestId: number;
  requesterUserId?: string;
  bloodGroup: string;
  component: string;
  unitsRequested: number;
  urgency: string;
  deliveryAddress: string;
  compatibleDonorGroups?: string[];
  targetHubIds?: number[];
}): void {
  if (!io) return;

  // Broadcast to all Hospitals in the network (or specific targeted hubs)
  const alertEvent = {
    type: 'EMERGENCY_BLOOD_ALERT',
    priority: payload.urgency,
    message: `URGENT BLOOD REQUISITION: ${payload.unitsRequested} unit(s) of ${payload.bloodGroup} ${payload.component} needed immediately at ${payload.deliveryAddress}.`,
    requestId: payload.requestId,
    requesterUserId: payload.requesterUserId,
    bloodGroup: payload.bloodGroup,
    component: payload.component,
    unitsRequested: payload.unitsRequested,
    timestamp: new Date().toISOString(),
    meta: {
      requestId: payload.requestId,
      requesterUserId: payload.requesterUserId,
      bloodGroup: payload.bloodGroup,
      component: payload.component,
      unitsRequested: payload.unitsRequested,
    },
  };

  if (payload.targetHubIds && payload.targetHubIds.length > 0) {
    for (const hubId of payload.targetHubIds) {
      io.to(`hub:${hubId}`).emit('BLOOD_REQUEST_ALERT', alertEvent);
    }
  } else {
    io.to('role:HOSPITAL').emit('BLOOD_REQUEST_ALERT', alertEvent);
  }

  // Broadcast to all matching compatible citizen blood donors in real-time
  const donorGroups = payload.compatibleDonorGroups && payload.compatibleDonorGroups.length > 0
    ? payload.compatibleDonorGroups
    : [payload.bloodGroup];

  for (const group of donorGroups) {
    io.to(`blood:${group}`).emit('BLOOD_REQUEST_ALERT', {
      ...alertEvent,
      type: 'BLOOD_DONOR_SOS',
      message: `🚨 Emergency Need: ${payload.bloodGroup} blood requested at ${payload.deliveryAddress}. Can you walk in to donate?`,
    });
  }
}

/**
 * Dispatches live update to patient, donor, or hospital when blood request status advances.
 */
export function emitBloodRequestStatusUpdate(payload: {
  requestId: number;
  requesterUserId: string;
  donorUserId?: string | null;
  bloodGroup?: string;
  status: string;
  fulfillingHubName?: string;
}): void {
  if (!io) return;

  const eventData = {
    requestId: payload.requestId,
    status: payload.status,
    fulfillingHubName: payload.fulfillingHubName,
    bloodGroup: payload.bloodGroup,
    donorUserId: payload.donorUserId,
    requesterUserId: payload.requesterUserId,
    message: `Blood requisition #${payload.requestId} updated to: ${payload.status}.`,
    timestamp: new Date().toISOString(),
  };

  // Broadcast globally so all connected clients (citizens, hospitals) update or clear this requisition
  io.emit('BLOOD_ORDER_STATUS_CHANGED', eventData);

  // 1. Notify the requester specifically
  io.to(`user:${payload.requesterUserId}`).emit('BLOOD_ORDER_STATUS_CHANGED', eventData);

  // 2. Notify the committed donor if present
  if (payload.donorUserId) {
    io.to(`user:${payload.donorUserId}`).emit('BLOOD_ORDER_STATUS_CHANGED', eventData);
  }

  // 3. Notify the citizen blood group room
  if (payload.bloodGroup) {
    io.to(`blood:${payload.bloodGroup}`).emit('BLOOD_ORDER_STATUS_CHANGED', eventData);
  }

  // 4. Notify facilities
  io.to('role:HOSPITAL').emit('BLOOD_ORDER_STATUS_CHANGED', eventData);
}
