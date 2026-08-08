const mongoose = require('mongoose');
const URI = 'mongodb+srv://onoawal3_db_user:mudah111@lyrablox.acn1kql.mongodb.net/lyrablox?appName=LyraBlox';

mongoose.connect(URI).then(async () => {
  const db = mongoose.connection.db;
  const result = await db.collection('storesettings').updateOne({}, { $unset: { status: '' } });
  console.log('Removed orphaned status field:', JSON.stringify(result));
  const doc = await db.collection('storesettings').findOne({});
  console.log('Updated document:', JSON.stringify(doc, null, 2));
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
