
import axios from 'axios';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

const API_URL = 'http://localhost:3000';
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'nest_db',
};

const NUM_USERS = 50;
const INITIAL_BALANCE = 10000;
const BID_AMOUNT = 100;
const STARTING_PRICE = 10;

async function runTest() {
  console.log('Starting concurrency test...');

  // 1. Connect to Database
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    console.log('Connected to database.');
  } catch (err) {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  }

  try {
    const timestamp = Date.now();
    const users: { id: string; email: string; token: string }[] = [];

    // 2. Register Users
    console.log(`Registering ${NUM_USERS} users...`);
    // Run sequentially to avoid rate limits or overloading registration (though parallel is also fine)
    // Using parallel for speed
    const registerPromises = Array.from({ length: NUM_USERS }, (_, i) => {
      const email = `test_user_${timestamp}_${i}@example.com`;
      const password = 'password123';
      return axios.post(`${API_URL}/auth/register`, { email, password })
        .then(res => ({
          email,
          token: res.data.accessToken,
          // We need to fetch ID? The register response doesn't return ID directly in some implementations
          // But looking at AuthService.register, it returns { accessToken }.
          // The payload has sub (id). We can decode it OR fetch user from DB.
          // Since we have DB access, let's just fetch IDs from DB to be sure.
        }))
        .catch(err => {
            console.error(`Failed to register ${email}:`, err.message);
            throw err;
        });
    });

    const registeredUsers = await Promise.all(registerPromises);
    
    // Get User IDs and Fund them
    console.log('Funding users...');
    for (const u of registeredUsers) {
      // Get ID
      const res = await client.query('SELECT id FROM "user" WHERE email = $1', [u.email]);
      const userId = res.rows[0].id;
      users.push({ ...u, id: userId });

      // Fund
      await client.query('UPDATE "user" SET balance = $1 WHERE id = $2', [INITIAL_BALANCE, userId]);
    }
    console.log('Users funded.');

    // 3. Create Auction (User 0 creates)
    console.log('Creating auction...');
    const creator = users[0];
    const auctionData = {
      title: `Concurrency Test Auction ${timestamp}`,
      description: 'A test auction for concurrency',
      startingPrice: STARTING_PRICE,
      endsAt: new Date(Date.now() + 60000).toISOString(), // Ends in 1 minute
    };

    const createRes = await axios.post(`${API_URL}/auctions`, auctionData, {
      headers: { Authorization: `Bearer ${creator.token}` },
    });
    const auctionId = createRes.data.id;
    console.log(`Auction created: ${auctionId}`);

    // 4. Fire 50 Parallel Bids
    // Everyone bids BID_AMOUNT (100). Only one should succeed.
    console.log(`Firing ${NUM_USERS} parallel bid requests of ${BID_AMOUNT}...`);
    
    const bidPromises = users.map((user, i) => {
        return axios.post(`${API_URL}/auctions/${auctionId}/bid`, 
            { amount: BID_AMOUNT },
            { headers: { Authorization: `Bearer ${user.token}` } }
        ).then(res => ({ status: 'success', user, data: res.data }))
         .catch(err => ({ status: 'fail', user, error: err.response?.data || err.message }));
    });

    const results = await Promise.all(bidPromises);
    
    // 5. Assertions
    const successes = results.filter(r => r.status === 'success');
    const failures = results.filter(r => r.status === 'fail');
    if (failures.length > 0) {
        console.error('First failure error:', JSON.stringify((failures[0] as any).error, null, 2));
    }

    if (successes.length !== 1) {
        console.error(`FAILED: Expected exactly 1 winner, got ${successes.length}`);
        // Log the successes to see what happened
        console.log('Successful bids:', successes.map(s => s.user.email));
    } else {
        console.log('PASSED: Exactly one winner.');
    }

    // Check Auction State
    const auctionRes = await axios.get(`${API_URL}/auctions/${auctionId}`);
    const auction = auctionRes.data;

    if (Number(auction.currentPrice) !== BID_AMOUNT) {
        console.error(`FAILED: Current price should be ${BID_AMOUNT}, got ${auction.currentPrice}`);
    } else {
        console.log('PASSED: Current price is correct.');
    }

    if (!auction.winner) {
         console.error('FAILED: No winner in auction record.');
    } else if (successes.length === 1 && auction.winner.id !== successes[0].user.id) {
         console.error(`FAILED: Winner ID mismatch. Expected ${successes[0].user.id}, got ${auction.winner.id}`);
    } else {
         console.log('PASSED: Winner matches successful bidder.');
    }

    // Check Balances
    console.log('Verifying balances...');
    let balanceErrors = 0;
    for (const r of results) {
        const dbUser = await client.query('SELECT balance FROM "user" WHERE id = $1', [r.user.id]);
        const balance = Number(dbUser.rows[0].balance);
        
        if (r.status === 'success') {
            // Should be deduced
            const expected = INITIAL_BALANCE - BID_AMOUNT;
            if (balance !== expected) {
                console.error(`FAILED: Winner ${r.user.email} balance incorrect. Expected ${expected}, got ${balance}`);
                balanceErrors++;
            }
        } else {
            // Should be original
            if (balance !== INITIAL_BALANCE) {
                 console.error(`FAILED: Loser ${r.user.email} balance incorrect. Expected ${INITIAL_BALANCE}, got ${balance}`);
                 balanceErrors++;
            }
        }
        
        if (balance < 0) {
             console.error(`CRITICAL FAILED: Negative balance for ${r.user.email}: ${balance}`);
             balanceErrors++;
        }
    }

    if (balanceErrors === 0) {
        console.log('PASSED: All balances correct. No negative balances.');
    }

    // Check for duplicate settlements?
    // We can't easily check 'duplicate settlements' as we aren't settling.
    // But we verified only 1 bid succeeded, so only 1 price update occurred.
    
    console.log('Test complete.');

  } catch (err) {
    console.error('Test failed with error:', err);
  } finally {
    await client.end();
  }
}

runTest();
