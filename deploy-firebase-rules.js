#!/usr/bin/env node

/**
 * Firebase Rules Deployment Script
 * 
 * This script helps deploy Firebase security rules for the JEE Growth Tracker.
 * 
 * Usage: node deploy-firebase-rules.js
 * 
 * Prerequisites:
 * - Firebase CLI installed and authenticated
 * - Firebase project initialized
 * - Proper permissions to deploy rules
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Deploying Firebase Security Rules for JEE Growth Tracker...\n');

// Check if Firebase CLI is installed
try {
    execSync('firebase --version', { stdio: 'pipe' });
    console.log('✅ Firebase CLI found');
} catch (error) {
    console.error('❌ Firebase CLI not found. Please install it first:');
    console.error('   npm install -g firebase-tools');
    console.error('   firebase login');
    process.exit(1);
}

// Check if we're in a Firebase project
try {
    execSync('firebase projects:list', { stdio: 'pipe' });
    console.log('✅ Firebase CLI authenticated');
} catch (error) {
    console.error('❌ Firebase CLI not authenticated. Please run:');
    console.error('   firebase login');
    process.exit(1);
}

// Check if rules files exist
const rulesFiles = [
    'firestore.rules',
    'storage.rules'
];

rulesFiles.forEach(file => {
    if (!fs.existsSync(file)) {
        console.error(`❌ Rules file not found: ${file}`);
        process.exit(1);
    }
    console.log(`✅ Found rules file: ${file}`);
});

// Deploy Firestore rules
console.log('\n📋 Deploying Firestore rules...');
try {
    execSync('firebase deploy --only firestore:rules', { stdio: 'inherit' });
    console.log('✅ Firestore rules deployed successfully');
} catch (error) {
    console.error('❌ Failed to deploy Firestore rules');
    process.exit(1);
}

// Deploy Storage rules
console.log('\n📁 Deploying Storage rules...');
try {
    execSync('firebase deploy --only storage', { stdio: 'inherit' });
    console.log('✅ Storage rules deployed successfully');
} catch (error) {
    console.error('❌ Failed to deploy Storage rules');
    process.exit(1);
}

// Verify deployment
console.log('\n🔍 Verifying deployment...');
try {
    const firestoreRules = execSync('firebase firestore:rules:list', { encoding: 'utf8' });
    console.log('✅ Firestore rules are active');
} catch (error) {
    console.warn('⚠️  Could not verify Firestore rules');
}

try {
    const storageRules = execSync('firebase storage:rules:list', { encoding: 'utf8' });
    console.log('✅ Storage rules are active');
} catch (error) {
    console.warn('⚠️  Could not verify Storage rules');
}

console.log('\n🎉 Firebase Security Rules deployment completed!');
console.log('\n📖 Next steps:');
console.log('1. Configure Authentication settings in Firebase Console');
console.log('2. Test the security rules with your application');
console.log('3. Monitor the Firebase Console for any issues');
console.log('4. Review the FIREBASE_SECURITY_GUIDE.md for detailed information');

console.log('\n🔗 Useful links:');
console.log('- Firebase Console: https://console.firebase.google.com');
console.log('- Firestore Rules: https://console.firebase.google.com/project/_/firestore/rules');
console.log('- Storage Rules: https://console.firebase.google.com/project/_/storage/rules');
console.log('- Authentication: https://console.firebase.google.com/project/_/authentication');
