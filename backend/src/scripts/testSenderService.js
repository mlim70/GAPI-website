#!/usr/bin/env node

/**
 * Sender.net Service Test and Debug Script (JavaScript Version)
 * 
 * This script tests the Sender.net email service configuration and API endpoints
 * to help identify issues with email sending.
 * 
 * Usage: node src/scripts/testSenderService.js
 */

const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

class SenderServiceTester {
  constructor() {
    this.apiKey = process.env.SENDER_API_KEY;
    this.domain = process.env.SENDER_DOMAIN;
    this.listId = process.env.SENDER_LIST_ID;
    this.baseUrl = 'https://api.sender.net/v2';
    this.results = [];
  }

  log(message, data) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (data) {
      console.log('   Data:', JSON.stringify(data, null, 2));
    }
  }

  addResult(test, success, details, error) {
    const result = { test, success, details, error };
    this.results.push(result);
    
    const status = success ? '✅' : '❌';
    this.log(`${status} ${test}`);
    if (error) {
      this.log(`   Error: ${error}`);
    }
    if (details) {
      this.log(`   Details:`, details);
    }
  }

  async testEnvironmentVariables() {
    this.log('🔍 Testing environment variables...');
    
    const envVars = {
      SENDER_API_KEY: {
        present: !!this.apiKey,
        length: this.apiKey?.length || 0,
        prefix: this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'N/A'
      },
      SENDER_DOMAIN: {
        present: !!this.domain,
        value: this.domain || 'N/A'
      },
      SENDER_LIST_ID: {
        present: !!this.listId,
        value: this.listId || 'N/A'
      }
    };

    const allPresent = envVars.SENDER_API_KEY.present && 
                      envVars.SENDER_DOMAIN.present && 
                      envVars.SENDER_LIST_ID.present;

    this.addResult(
      'Environment Variables Check',
      allPresent,
      envVars,
      allPresent ? undefined : 'Missing required environment variables'
    );
  }

  async testApiKeyFormat() {
    this.log('🔍 Testing API key format...');
    
    if (!this.apiKey) {
      this.addResult('API Key Format Check', false, {}, 'API key is missing');
      return;
    }

    // Check if API key looks like a valid Sender.net API key
    const isValidFormat = /^[a-zA-Z0-9]{32,}$/.test(this.apiKey);
    
    this.addResult(
      'API Key Format Check',
      isValidFormat,
      {
        length: this.apiKey.length,
        format: 'alphanumeric',
        valid: isValidFormat
      },
      isValidFormat ? undefined : 'API key format appears invalid'
    );
  }

  async testDomainFormat() {
    this.log('🔍 Testing domain format...');
    
    if (!this.domain) {
      this.addResult('Domain Format Check', false, {}, 'Domain is missing');
      return;
    }

    // Check if domain looks valid
    const isValidFormat = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(this.domain);
    
    this.addResult(
      'Domain Format Check',
      isValidFormat,
      {
        domain: this.domain,
        format: 'valid domain',
        valid: isValidFormat
      },
      isValidFormat ? undefined : 'Domain format appears invalid'
    );
  }

  async testApiConnectivity() {
    this.log('🔍 Testing API connectivity...');
    
    try {
      const response = await axios.get(`${this.baseUrl}/domains`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      this.addResult(
        'API Connectivity Test',
        true,
        {
          status: response.status,
          statusText: response.statusText,
          endpoint: `${this.baseUrl}/domains`,
          responseData: response.data
        }
      );
    } catch (error) {
      const details = {
        endpoint: `${this.baseUrl}/domains`,
        errorType: error.name,
        message: error.message
      };

      if (error.response) {
        details.status = error.response.status;
        details.statusText = error.response.statusText;
        details.responseData = error.response.data;
        details.responseHeaders = error.response.headers;
      }

      if (error.request) {
        details.requestMade = true;
        details.requestUrl = error.request.url;
        details.requestMethod = error.request.method;
      }

      this.addResult(
        'API Connectivity Test',
        false,
        details,
        `API request failed: ${error.message}`
      );
    }
  }

  async testEmailsEndpoint() {
    this.log('🔍 Testing /emails endpoint...');
    
    try {
      const testEmailData = {
        from: `test@${this.domain}`,
        to: 'test@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>'
      };

      const response = await axios.post(`${this.baseUrl}/emails`, testEmailData, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      this.addResult(
        '/emails Endpoint Test',
        true,
        {
          status: response.status,
          statusText: response.statusText,
          endpoint: `${this.baseUrl}/emails`,
          responseData: response.data
        }
      );
    } catch (error) {
      const details = {
        endpoint: `${this.baseUrl}/emails`,
        errorType: error.name,
        message: error.message
      };

      if (error.response) {
        details.status = error.response.status;
        details.statusText = error.response.statusText;
        details.responseData = error.response.data;
        details.responseHeaders = error.response.headers;
      }

      if (error.request) {
        details.requestMade = true;
        details.requestUrl = error.request.url;
        details.requestMethod = error.request.method;
      }

      this.addResult(
        '/emails Endpoint Test',
        false,
        details,
        `Emails endpoint failed: ${error.message}`
      );
    }
  }

  async testSubscribersEndpoint() {
    this.log('🔍 Testing /subscribers endpoint...');
    
    try {
      const response = await axios.get(`${this.baseUrl}/subscribers`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      this.addResult(
        '/subscribers Endpoint Test',
        true,
        {
          status: response.status,
          statusText: response.statusText,
          endpoint: `${this.baseUrl}/subscribers`,
          responseData: response.data
        }
      );
    } catch (error) {
      const details = {
        endpoint: `${this.baseUrl}/subscribers`,
        errorType: error.name,
        message: error.message
      };

      if (error.response) {
        details.status = error.response.status;
        details.statusText = error.response.statusText;
        details.responseData = error.response.data;
        details.responseHeaders = error.response.headers;
      }

      if (error.request) {
        details.requestMade = true;
        details.requestUrl = error.request.url;
        details.requestMethod = error.request.method;
      }

      this.addResult(
        '/subscribers Endpoint Test',
        false,
        details,
        `Subscribers endpoint failed: ${error.message}`
      );
    }
  }

  async testAvailableEndpoints() {
    this.log('🔍 Testing available API endpoints...');
    
    const endpoints = [
      '/domains',
      '/emails',
      '/subscribers',
      '/lists',
      '/templates',
      '/campaigns',
      '/transactions'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`${this.baseUrl}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        });

        this.addResult(
          `Endpoint ${endpoint} Test`,
          true,
          {
            endpoint: `${this.baseUrl}${endpoint}`,
            status: response.status,
            available: true
          }
        );
      } catch (error) {
        const available = error.response?.status !== 404;
        this.addResult(
          `Endpoint ${endpoint} Test`,
          available,
          {
            endpoint: `${this.baseUrl}${endpoint}`,
            status: error.response?.status || 'No response',
            available: available
          },
          available ? undefined : `Endpoint ${endpoint} not available (404)`
        );
      }
    }
  }

  async testAlternativeEndpoints() {
    this.log('🔍 Testing alternative email endpoints...');
    
    const alternativeEndpoints = [
      '/transactions',
      '/campaigns',
      '/templates'
    ];

    for (const endpoint of alternativeEndpoints) {
      try {
        const testData = {
          from: `test@${this.domain}`,
          to: 'test@example.com',
          subject: 'Test Email',
          text: 'This is a test email'
        };

        const response = await axios.post(`${this.baseUrl}${endpoint}`, testData, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });

        this.addResult(
          `Alternative Endpoint ${endpoint} Test`,
          true,
          {
            endpoint: `${this.baseUrl}${endpoint}`,
            status: response.status,
            available: true,
            responseData: response.data
          }
        );
      } catch (error) {
        const available = error.response?.status !== 404;
        const details = {
          endpoint: `${this.baseUrl}${endpoint}`,
          status: error.response?.status || 'No response',
          available: available,
          error: error.message
        };

        if (error.response) {
          details.responseData = error.response.data;
        }

        this.addResult(
          `Alternative Endpoint ${endpoint} Test`,
          available,
          details,
          available ? undefined : `Endpoint ${endpoint} not available (404)`
        );
      }
    }
  }

  async runAllTests() {
    this.log('🚀 Starting Sender.net Service Tests...');
    this.log(`   API Key: ${this.apiKey ? 'Present' : 'Missing'}`);
    this.log(`   Domain: ${this.domain || 'Missing'}`);
    this.log(`   List ID: ${this.listId || 'Missing'}`);
    this.log(`   Base URL: ${this.baseUrl}`);
    console.log('');

    await this.testEnvironmentVariables();
    await this.testApiKeyFormat();
    await this.testDomainFormat();
    await this.testApiConnectivity();
    await this.testEmailsEndpoint();
    await this.testSubscribersEndpoint();
    await this.testAvailableEndpoints();
    await this.testAlternativeEndpoints();

    this.generateReport();
  }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 SENDER.NET SERVICE TEST REPORT');
    console.log('='.repeat(80));

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (failedTests > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results
        .filter(r => !r.success)
        .forEach(result => {
          console.log(`\n   ${result.test}:`);
          console.log(`   Error: ${result.error}`);
          if (result.details) {
            console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
          }
        });
    }

    console.log('\n🔍 RECOMMENDATIONS:');
    
    if (failedTests === 0) {
      console.log('   All tests passed! The Sender.net service appears to be working correctly.');
    } else {
      if (!this.apiKey) {
        console.log('   • Set SENDER_API_KEY environment variable');
      }
      if (!this.domain) {
        console.log('   • Set SENDER_DOMAIN environment variable');
      }
      if (!this.listId) {
        console.log('   • Set SENDER_LIST_ID environment variable');
      }
      
      const apiConnectivityFailed = this.results.find(r => 
        r.test === 'API Connectivity Test' && !r.success
      );
      if (apiConnectivityFailed) {
        console.log('   • Check your Sender.net API key and account status');
        console.log('   • Verify your Sender.net subscription plan');
      }

      const emailsEndpointFailed = this.results.find(r => 
        r.test === '/emails Endpoint Test' && !r.success
      );
      if (emailsEndpointFailed) {
        console.log('   • The /emails endpoint may not be available in your plan');
        console.log('   • Consider using /transactions or /campaigns instead');
        console.log('   • Check Sender.net documentation for your plan\'s available endpoints');
      }

      // Check if alternative endpoints work
      const alternativeEndpoints = this.results.filter(r => 
        r.test.includes('Alternative Endpoint') && r.success
      );
      if (alternativeEndpoints.length > 0) {
        console.log('   • Alternative endpoints are available and working:');
        alternativeEndpoints.forEach(result => {
          const endpoint = result.details.endpoint.split('/').pop();
          console.log(`     - ${endpoint} (${result.details.status})`);
        });
      }
    }

    console.log('\n' + '='.repeat(80));
  }
}

// Main execution
async function main() {
  try {
    const tester = new SenderServiceTester();
    await tester.runAllTests();
  } catch (error) {
    console.error('❌ Script execution failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { SenderServiceTester };
