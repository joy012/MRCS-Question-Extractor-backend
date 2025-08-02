import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ExtractionService } from '../extraction/extraction.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})
export class ExtractionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ExtractionGateway.name);

  constructor(private readonly extractionService: ExtractionService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-extraction-room')
  handleJoinExtractionRoom(client: Socket) {
    client.join('extraction-room');
    this.logger.log(`Client ${client.id} joined extraction room`);
    
    // Send current status immediately
    this.sendCurrentStatus(client);
  }

  @SubscribeMessage('leave-extraction-room')
  handleLeaveExtractionRoom(client: Socket) {
    client.leave('extraction-room');
    this.logger.log(`Client ${client.id} left extraction room`);
  }

  @SubscribeMessage('get-status')
  async handleGetStatus(client: Socket) {
    const status = await this.extractionService.getStatus();
    client.emit('extraction-status', status);
  }

  @SubscribeMessage('get-logs')
  async handleGetLogs(client: Socket) {
    const logs = await this.extractionService.getLogs();
    client.emit('extraction-logs', logs);
  }

  // Send current status to a specific client
  private async sendCurrentStatus(client: Socket) {
    const status = await this.extractionService.getStatus();
    client.emit('extraction-status', status);
  }

  // Broadcast status update to all clients in extraction room
  async broadcastStatusUpdate(status: any) {
    this.server.to('extraction-room').emit('extraction-status', status);
  }

  // Broadcast log update to all clients in extraction room
  async broadcastLogUpdate(logs: any) {
    this.server.to('extraction-room').emit('extraction-logs', logs);
  }

  // Broadcast progress update to all clients in extraction room
  async broadcastProgressUpdate(progress: any) {
    this.server.to('extraction-room').emit('extraction-progress', progress);
  }
} 