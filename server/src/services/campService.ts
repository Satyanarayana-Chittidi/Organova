import { findHubByUserId } from '../models/hubModel';
import { createCamp, updateCamp, findCampById, listCamps, listCampsByHub, updateCampStatus, } from '../models/campModel';
import { BloodDonationCamp, CreateCampDTO, UpdateCampDTO } from '../types/camp';
function parseTimeToMinutes(timeStr?: string | null): number | null {
    if (!timeStr)
        return null;
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match)
        return null;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridiem = match[3]?.toUpperCase();
    if (meridiem === 'PM' && hours < 12)
        hours += 12;
    if (meridiem === 'AM' && hours === 12)
        hours = 0;
    return hours * 60 + minutes;
}
export function validateCampDateTime(campDateStr: string, endDateStr?: string | null, startTimeStr?: string | null, endTimeStr?: string | null) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    const cleanCampDate = campDateStr.split('T')[0];
    if (cleanCampDate < todayStr) {
        const error: any = new Error(`Camp date (${cleanCampDate}) cannot be in the past. Camps can only be scheduled for future dates.`);
        error.statusCode = 400;
        throw error;
    }
    if (cleanCampDate === todayStr && startTimeStr) {
        const startMinutes = parseTimeToMinutes(startTimeStr);
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        if (startMinutes !== null && startMinutes < currentMinutes) {
            const error: any = new Error(`Start time (${startTimeStr}) cannot be in the past for a camp scheduled today. Please choose an upcoming time.`);
            error.statusCode = 400;
            throw error;
        }
    }
    if (endDateStr) {
        const cleanEndDate = endDateStr.split('T')[0];
        if (cleanEndDate < cleanCampDate) {
            const error: any = new Error(`End date (${cleanEndDate}) cannot be earlier than start date (${cleanCampDate}).`);
            error.statusCode = 400;
            throw error;
        }
        if (cleanEndDate === cleanCampDate && startTimeStr && endTimeStr) {
            const startMinutes = parseTimeToMinutes(startTimeStr);
            const endMinutes = parseTimeToMinutes(endTimeStr);
            if (startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes) {
                const error: any = new Error(`End time (${endTimeStr}) must be after start time (${startTimeStr}).`);
                error.statusCode = 400;
                throw error;
            }
        }
    }
}
export async function createCampService(userId: string, userRole: string, dto: CreateCampDTO): Promise<BloodDonationCamp> {
    if (!['HOSPITAL', 'ADMIN'].includes(userRole)) {
        const error: any = new Error('Access denied. Only registered hospitals and medical centers can organize donation camps.');
        error.statusCode = 403;
        throw error;
    }
    const hub = await findHubByUserId(userId);
    if (!hub && userRole !== 'ADMIN') {
        const error: any = new Error('Medical facility profile not associated with this coordinator account.');
        error.statusCode = 404;
        throw error;
    }
    if (hub && hub.verification_status !== 'ACTIVE') {
        const error: any = new Error(`Cannot create camps: Medical hub status is currently '${hub.verification_status}'. Only active verified facilities can host drives.`);
        error.statusCode = 403;
        throw error;
    }
    if (!dto.camp_name || dto.camp_name.trim().length === 0) {
        const error: any = new Error('Camp name is required.');
        error.statusCode = 400;
        throw error;
    }
    if (!dto.venue_name || dto.venue_name.trim().length === 0) {
        const error: any = new Error('Venue name / Hall / Location is required.');
        error.statusCode = 400;
        throw error;
    }
    if (!dto.address_line || dto.address_line.trim().length === 0) {
        const error: any = new Error('Venue address is required.');
        error.statusCode = 400;
        throw error;
    }
    if (!dto.city || dto.city.trim().length === 0) {
        const error: any = new Error('City is required.');
        error.statusCode = 400;
        throw error;
    }
    if (!dto.camp_date) {
        const error: any = new Error('Camp start date is required.');
        error.statusCode = 400;
        throw error;
    }
    validateCampDateTime(dto.camp_date, dto.end_date, dto.start_time, dto.end_time);
    const hubId = hub ? hub.id : 1;
    return createCamp(hubId, userId, dto);
}
export async function updateCampService(userId: string, userRole: string, campId: number, dto: UpdateCampDTO): Promise<BloodDonationCamp> {
    const camp = await findCampById(campId);
    if (!camp) {
        const error: any = new Error('Camp not found.');
        error.statusCode = 404;
        throw error;
    }
    const hub = await findHubByUserId(userId);
    if (userRole !== 'ADMIN' && (!hub || hub.id !== camp.organizer_hub_id)) {
        const error: any = new Error('Permission denied. You can only edit camps organized by your medical facility.');
        error.statusCode = 403;
        throw error;
    }
    if (camp.status === 'COMPLETED' || camp.status === 'CANCELLED') {
        const error: any = new Error(`Cannot edit a camp that is already ${camp.status.toLowerCase()}.`);
        error.statusCode = 400;
        throw error;
    }
    const targetStartDate = dto.camp_date || camp.camp_date;
    const targetEndDate = dto.end_date !== undefined ? dto.end_date : camp.end_date;
    const targetStartTime = dto.start_time || camp.start_time;
    const targetEndTime = dto.end_time || camp.end_time;
    if (dto.camp_date || dto.end_date || dto.start_time || dto.end_time) {
        validateCampDateTime(targetStartDate, targetEndDate, targetStartTime, targetEndTime);
    }
    return updateCamp(campId, dto);
}
export async function getCampsService(filters: {
    status?: string;
    city?: string;
}): Promise<BloodDonationCamp[]> {
    return listCamps(filters);
}
export async function getCampByIdService(campId: number): Promise<BloodDonationCamp> {
    const camp = await findCampById(campId);
    if (!camp) {
        const error: any = new Error('Blood donation camp not found.');
        error.statusCode = 404;
        throw error;
    }
    return camp;
}
export async function getMyHubCampsService(userId: string): Promise<BloodDonationCamp[]> {
    const hub = await findHubByUserId(userId);
    if (!hub) {
        return [];
    }
    return listCampsByHub(hub.id);
}
export async function updateCampStatusService(userId: string, userRole: string, campId: number, status: string): Promise<boolean> {
    const camp = await findCampById(campId);
    if (!camp) {
        const error: any = new Error('Camp not found.');
        error.statusCode = 404;
        throw error;
    }
    const hub = await findHubByUserId(userId);
    if (userRole !== 'ADMIN' && (!hub || hub.id !== camp.organizer_hub_id)) {
        const error: any = new Error('Permission denied. You can only manage camps organized by your medical facility.');
        error.statusCode = 403;
        throw error;
    }
    const validStatuses = ['DRAFT', 'UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
        const error: any = new Error(`Invalid status: '${status}'. Allowed statuses are: ${validStatuses.join(', ')}`);
        error.statusCode = 400;
        throw error;
    }
    return updateCampStatus(campId, status);
}
