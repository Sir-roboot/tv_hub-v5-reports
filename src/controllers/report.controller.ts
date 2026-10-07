import { unlink } from 'node:fs/promises';
import type { RequestHandler } from 'express';
import { isValidObjectId } from 'mongoose';
import { Channel } from '../models/channel.model.js';
import { Report, reportReasons, reportStatuses } from '../models/report.model.js';
import { AppError } from '../utils/app-error.js';

function getUserId(request: Parameters<RequestHandler>[0]): string {
  if (!request.auth) throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required');
  return request.auth.userId;
}

function readRequiredText(value: unknown, code: string, message: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new AppError(400, code, message);
  return value.trim();
}

async function removeUploadedEvidence(files: Express.Multer.File[]): Promise<void> {
  await Promise.all(files.map((file) => unlink(file.path).catch(() => undefined)));
}

export const createReport: RequestHandler = async (request, response) => {
  const files = (request.files ?? []) as Express.Multer.File[];

  try {
    const userId = getUserId(request);
    const channelId = readRequiredText(request.body.channelId, 'INVALID_CHANNEL_ID', 'Channel id is invalid');
    if (!isValidObjectId(channelId)) throw new AppError(400, 'INVALID_CHANNEL_ID', 'Channel id is invalid');

    const reason = readRequiredText(request.body.reason, 'INVALID_REPORT_REASON', 'Report reason is invalid');
    if (!reportReasons.includes(reason as (typeof reportReasons)[number])) {
      throw new AppError(400, 'INVALID_REPORT_REASON', 'Report reason is invalid');
    }

    const description = readRequiredText(request.body.description, 'INVALID_REPORT_DESCRIPTION', 'Description is required');
    if (description.length > 1000) {
      throw new AppError(400, 'INVALID_REPORT_DESCRIPTION', 'Description must be 1000 characters or fewer');
    }

    const channel = await Channel.findOne({ _id: channelId, isActive: true });
    if (!channel) throw new AppError(404, 'CHANNEL_NOT_FOUND', 'Channel was not found');

    const evidenceUrls = files.map((file) => `/uploads/reports/${file.filename}`);

    const report = await Report.create({
      userId,
      channelId,
      reason,
      description,
      evidenceUrls
    });

    response.status(201).json({ report });
  } catch (error) {
    await removeUploadedEvidence(files);
    throw error;
  }
};

export const listReports: RequestHandler = async (request, response) => {
  const reports = await Report.find({ userId: getUserId(request) })
    .populate('channelId', 'name')
    .sort('-createdAt');

  response.json({ reports });
};

export const updateReport: RequestHandler = async (request, response) => {
  const reportId = request.params.id;
  if (!isValidObjectId(reportId)) {
    throw new AppError(400, 'INVALID_REPORT_ID', 'Report id is invalid');
  }

  const reason = readRequiredText(request.body.reason, 'INVALID_REPORT_REASON', 'Report reason is invalid');
  if (!reportReasons.includes(reason as (typeof reportReasons)[number])) {
    throw new AppError(400, 'INVALID_REPORT_REASON', 'Report reason is invalid');
  }

  const description = readRequiredText(request.body.description, 'INVALID_REPORT_DESCRIPTION', 'Description is required');
  if (description.length > 1000) {
    throw new AppError(400, 'INVALID_REPORT_DESCRIPTION', 'Description must be 1000 characters or fewer');
  }

  const status = readRequiredText(request.body.status, 'INVALID_REPORT_STATUS', 'Report status is invalid');
  if (!reportStatuses.includes(status as (typeof reportStatuses)[number])) {
    throw new AppError(400, 'INVALID_REPORT_STATUS', 'Report status is invalid');
  }

  const report = await Report.findOneAndUpdate(
    { _id: reportId, userId: getUserId(request) },
    { reason, description, status },
    { new: true, runValidators: true }
  ).populate('channelId', 'name');

  if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report was not found');
  response.json({ report });
};

export const deleteReport: RequestHandler = async (request, response) => {
  const reportId = request.params.id;
  if (!isValidObjectId(reportId)) {
    throw new AppError(400, 'INVALID_REPORT_ID', 'Report id is invalid');
  }

  const report = await Report.findOneAndDelete({
    _id: reportId,
    userId: getUserId(request)
  });

  if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report was not found');
  response.status(204).send();
};
