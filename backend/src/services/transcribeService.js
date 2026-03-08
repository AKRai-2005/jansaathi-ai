import {
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
} from '@aws-sdk/client-transcribe';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { transcribeClient, s3Client, AWS_CONFIG } from '../config/aws.js';
import Groq from 'groq-sdk';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';

class TranscriptionService {
  constructor() {
    this.bucket = AWS_CONFIG.S3_BUCKET;
    this.maxPollTime = 60000; // 60 seconds
    this.pollInterval = 2000; // 2 seconds

    // Groq Whisper client for fast real-time transcription
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    this.whisperModel = 'whisper-large-v3';

    console.log('🎤 Transcription service initialized (Groq Whisper primary + AWS Transcribe fallback)');
  }

  // ─────────────────────────────────────────────
  //  PRIMARY: Groq Whisper (instant, free)
  // ─────────────────────────────────────────────

  /**
   * Transcribe audio using Groq Whisper (instant, supports Indian languages)
   * @param {Buffer} audioBuffer - Audio file buffer (OGG Opus from Telegram)
   * @returns {Promise<{transcript: string, language: string}>}
   */
  async transcribeWithGroq(audioBuffer) {
    console.log('🎤 Transcribing with Groq Whisper...');
    const tempFile = path.join(os.tmpdir(), `jansaathi-voice-${Date.now()}.ogg`);

    try {
      // Write buffer to temp file (Groq SDK needs a ReadStream)
      fs.writeFileSync(tempFile, audioBuffer);

      const transcription = await this.groq.audio.transcriptions.create({
        file: fs.createReadStream(tempFile),
        model: this.whisperModel,
        response_format: 'verbose_json',
      });

      const transcript = transcription.text || '';
      const detectedLang = this.mapWhisperLanguage(transcription.language);

      console.log(`✅ Groq Whisper transcript (${detectedLang}): ${transcript.substring(0, 100)}...`);
      return { transcript, language: detectedLang };
    } finally {
      // Cleanup temp file
      try { fs.unlinkSync(tempFile); } catch {}
    }
  }

  /**
   * Map Whisper language name to short code
   * @param {string} whisperLang - Whisper language name (e.g., 'hindi')
   * @returns {string} Short code (e.g., 'hi')
   */
  mapWhisperLanguage(whisperLang) {
    const mapping = {
      hindi: 'hi',
      english: 'en',
      tamil: 'ta',
      telugu: 'te',
      marathi: 'mr',
      bengali: 'bn',
      gujarati: 'gu',
      kannada: 'kn',
      malayalam: 'ml',
      punjabi: 'pa',
      urdu: 'ur',
      assamese: 'as',
      odia: 'or',
    };
    return mapping[whisperLang?.toLowerCase()] || 'hi';
  }

  // ─────────────────────────────────────────────
  //  FALLBACK: AWS Transcribe (batch, 15-60s)
  // ─────────────────────────────────────────────

  /**
   * Upload audio file to S3
   * @param {Buffer} audioBuffer - Audio file buffer
   * @param {string} fileId - Unique file identifier
   * @returns {Promise<string>} S3 URI
   */
  async uploadAudioToS3(audioBuffer, fileId) {
    console.log(`📤 Uploading audio to S3: ${fileId}`);

    const key = `audio/${Date.now()}-${fileId}.ogg`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: audioBuffer,
        ContentType: 'audio/ogg',
      });

      await s3Client.send(command);
      const s3Uri = `s3://${this.bucket}/${key}`;
      console.log(`✅ Audio uploaded: ${s3Uri}`);
      return s3Uri;
    } catch (error) {
      console.error('❌ Failed to upload audio:', error.message);
      throw error;
    }
  }

  /**
   * Start transcription job with AWS Transcribe
   * NOTE: IdentifyLanguage and LanguageCode are mutually exclusive
   * @param {string} s3Uri - S3 URI of audio file
   * @returns {Promise<string>} Job name
   */
  async transcribeAudio(s3Uri) {
    const jobName = `jansaathi-${Date.now()}`;
    console.log(`🎤 Starting AWS Transcribe job: ${jobName}`);

    try {
      const command = new StartTranscriptionJobCommand({
        TranscriptionJobName: jobName,
        // Do NOT set LanguageCode when IdentifyLanguage is true (they are mutually exclusive)
        MediaFormat: 'ogg',
        Media: {
          MediaFileUri: s3Uri,
        },
        IdentifyLanguage: true,
        LanguageOptions: ['hi-IN', 'ta-IN', 'te-IN', 'mr-IN', 'bn-IN', 'en-IN'],
      });

      await transcribeClient.send(command);
      console.log('✅ AWS Transcription job started');
      return jobName;
    } catch (error) {
      console.error('❌ Failed to start transcription:', error.message);
      throw error;
    }
  }

  /**
   * Poll transcription job until complete or timeout
   * @param {string} jobName - Transcription job name
   * @param {number} maxWaitSeconds - Maximum wait time in seconds
   * @returns {Promise<Object>} Transcription job result
   */
  async pollTranscriptionJob(jobName, maxWaitSeconds = 60) {
    console.log(`⏳ Polling transcription job: ${jobName}`);

    const startTime = Date.now();
    const maxWaitMs = maxWaitSeconds * 1000;

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const command = new GetTranscriptionJobCommand({
          TranscriptionJobName: jobName,
        });

        const response = await transcribeClient.send(command);
        const job = response.TranscriptionJob;
        const status = job.TranscriptionJobStatus;

        console.log(`📊 Job status: ${status}`);

        if (status === 'COMPLETED') {
          console.log('✅ Transcription completed');
          return job;
        } else if (status === 'FAILED') {
          throw new Error(`Transcription failed: ${job.FailureReason}`);
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, this.pollInterval));
      } catch (error) {
        console.error('❌ Error polling transcription:', error.message);
        throw error;
      }
    }

    throw new Error('Transcription timeout - job took too long');
  }

  /**
   * Get transcript text from transcription result
   * @param {string} transcriptUri - URI of transcript file
   * @returns {Promise<string>} Transcript text
   */
  async getTranscript(transcriptUri) {
    console.log(`📥 Fetching transcript from: ${transcriptUri}`);

    try {
      const response = await axios.get(transcriptUri);
      const transcript = response.data.results.transcripts[0].transcript;
      console.log(`✅ Transcript retrieved: ${transcript.substring(0, 100)}...`);
      return transcript;
    } catch (error) {
      console.error('❌ Failed to fetch transcript:', error.message);
      throw error;
    }
  }

  /**
   * Convert AWS language code to short code
   * @param {string} awsLangCode - AWS language code (e.g., 'hi-IN')
   * @returns {string} Short language code (e.g., 'hi')
   */
  mapLanguageCode(awsLangCode) {
    const mapping = {
      'hi-IN': 'hi',
      'en-IN': 'en',
      'en-US': 'en',
      'ta-IN': 'ta',
      'te-IN': 'te',
      'mr-IN': 'mr',
      'bn-IN': 'bn',
      'gu-IN': 'gu',
      'kn-IN': 'kn',
      'ml-IN': 'ml',
    };
    return mapping[awsLangCode] || 'hi';
  }

  /**
   * AWS Transcribe full workflow (slower batch mode)
   * @param {Buffer} audioBuffer - Audio file buffer
   * @param {string} fileId - Unique file identifier
   * @returns {Promise<{transcript: string, language: string}>}
   */
  async transcribeWithAWS(audioBuffer, fileId) {
    let s3Uri;

    try {
      // Step 1: Upload to S3
      s3Uri = await this.uploadAudioToS3(audioBuffer, fileId);

      // Step 2: Start transcription
      const jobName = await this.transcribeAudio(s3Uri);

      // Step 3: Poll for completion
      const job = await this.pollTranscriptionJob(jobName);

      // Step 4: Get transcript
      const transcript = await this.getTranscript(job.Transcript.TranscriptFileUri);

      // Step 5: Get detected language
      const detectedLang = job.LanguageCode || 'hi-IN';
      const language = this.mapLanguageCode(detectedLang);
      console.log(`🌐 AWS detected language: ${detectedLang} -> ${language}`);

      // Step 6: Cleanup (async, don't wait)
      this.deleteAudioFromS3(s3Uri).catch(() => {});

      return { transcript, language };
    } catch (error) {
      // Cleanup on error
      if (s3Uri) {
        this.deleteAudioFromS3(s3Uri).catch(() => {});
      }
      throw error;
    }
  }

  /**
   * Delete audio file from S3
   * @param {string} s3Uri - S3 URI of audio file
   */
  async deleteAudioFromS3(s3Uri) {
    try {
      const key = s3Uri.replace(`s3://${this.bucket}/`, '');
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await s3Client.send(command);
      console.log('✅ Audio deleted from S3');
    } catch (error) {
      console.error('⚠️  Failed to delete audio:', error.message);
    }
  }

  // ─────────────────────────────────────────────
  //  PUBLIC API: Auto-selects best provider
  // ─────────────────────────────────────────────

  /**
   * Transcribe a voice message — uses Groq Whisper (instant) with AWS Transcribe fallback
   * @param {Buffer} audioBuffer - Audio file buffer
   * @param {string} fileId - Unique file identifier
   * @returns {Promise<{transcript: string, language: string}>}
   */
  async transcribeVoiceMessage(audioBuffer, fileId) {
    // Primary: Groq Whisper (instant, free, great Indian language support)
    try {
      const result = await this.transcribeWithGroq(audioBuffer);
      if (result.transcript && result.transcript.trim().length > 0) {
        return result;
      }
      console.warn('⚠️  Groq Whisper returned empty transcript, trying AWS Transcribe...');
    } catch (error) {
      console.warn('⚠️  Groq Whisper failed, falling back to AWS Transcribe:', error.message);
    }

    // Fallback: AWS Transcribe (batch mode, slower but reliable)
    try {
      return await this.transcribeWithAWS(audioBuffer, fileId);
    } catch (awsError) {
      console.error('❌ AWS Transcribe also failed:', awsError.message);
      throw new Error('Voice transcription failed with both providers');
    }
  }
}

export default new TranscriptionService();
