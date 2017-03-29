<?php

class Bip_DAO_Auth extends Bip_DAO_Abstract {

  public function _getUserGraphEmails($graphStruct) {
    $emails = array($graphStruct['email']);
    foreach ($graphStruct['identities'] as $provider => $struct) {
      if (isset($struct['email'])) {
        $emails[] = $struct['email'];
      }
    }
    return array_unique($emails);
  }

  public static function checkAuthType() {
    $config = Zend_Registry::get('config');
    $options = $config->toArray();
    $authType = isset($options['auth']['type']) ? $options['auth']['type'] : 'login_primary';
    return $authType;
  }

  // returns a list of stats for the user for the last 30 days.
  public function getUserStats($accountId) {
    // hour min sec month day year
    //$lastMonth = date('Ymd', mktime(date('H'), date('i'), date('s'), date('n') - 1, date('j'), date('Y')));
    $dayReporting = -30;
    $lastMonthTS = mktime(0, 0, 0, date('n') - 1, date('j'), date('Y'));
    $todayTS = mktime();

    $lastMonth = date('Ymd', mktime(date('H'), date('i'), date('s'), date('n'), date('j') + $dayReporting, date('Y')));

    $results = $this->search(
            'StatsAccount', array(
        'owner_id' => $accountId,
        'day' => array('$gt' => $lastMonth)
            )
    );

    $normResults = array();
    foreach ($results as $result) {
      $normResults[(int) $result['day']] = array(
          'traffic_outbound_mb' => $result['traffic_outbound_mb'],
          'traffic_inbound_mb' => $result['traffic_inbound_mb'],
          'delivered_channel_outbound' => $result['delivered_channel_outbound'],
          'delivered_bip_inbound' => $result['delivered_bip_inbound'],
          'channels_total' => $result['channels_total'],
          'share_total' => $result['share_total'],
          'bips_total' => $result['bips_total']
      );
    };

    $currentDate = '';
    while ($dayReporting != 0) {
      $currentDate = date('Ymd', mktime(0, 0, 0, date('n'), date('j') + $dayReporting, date('Y')));
      if (!array_key_exists($currentDate, $normResults)) {
        $normResults[(int) $currentDate] = array();
      }

      $dayReporting++;
    }
    ksort($normResults);

    $networkStrength = $this->search(
            'StatsAccountNetwork', array(
        'owner_id' => $accountId,
        'day' => array('$gt' => (int) date('Ymd', mktime(date('H'), date('i'), date('s'), date('n'), date('j') - 2, date('Y'))))
            )
    );

    return array($normResults, $networkStrength[1]);
  }

  public function getAllStats($uid, $condensed = false) {

    list($stats, $network) = $this->getUserStats($uid);

    //
    $generalStats = array();

    $generalStats['inMb'] = array('label' => 'Received (Mb)', 'data' => 0);
    $generalStats['outMb'] = array('label' => 'Sent (Mb)', 'data' => 0);
    $generalStats['outChannel'] = array('label' => 'Messages Sent', 'data' => 0);
    $generalStats['inBip'] = array('label' => 'Messages Received', 'data' => 0);
    $generalStats['createdChannels'] = array('label' => 'New Actions', 'data' => 0);
    $generalStats['createdBips'] = array('label' => 'New Bips', 'data' => 0);
    $generalStats['sharedBips'] = array('label' => 'New Contributions', 'data' => 0);
    $generalStats['runningBips'] = array('label' => '# Running', 'data' => 0);

    foreach ($stats as $day => $stat) {
      if (!empty($stat)) {
        $generalStats['inMb']['data'] += $stat['traffic_inbound_mb'];
        $generalStats['outMb']['data'] += $stat['traffic_outbound_mb'];
        $generalStats['outChannel']['data'] += $stat['delivered_channel_outbound'];
        $generalStats['inBip']['data'] += $stat['delivered_bip_inbound'];
        $generalStats['createdChannels']['data'] += $stat['channels_total'];
        $generalStats['createdBips']['data'] += $stat['bips_total'];
        $generalStats['sharedBips']['data'] += $stat['share_total'];
      }
    }

    $generalStats['inMb']['data'] = sprintf('%.2f', $generalStats['inMb']['data']);
    $generalStats['outMb']['data'] = sprintf('%.2f', $generalStats['outMb']['data']);

    //var_dump($network);
    // generate a d3 chord matrix of relations
    /*
     * Actions (channels) linking to their channels.  Need to take the strength
     * graph and turn it into a square matrix
     *
     * @link https://github.com/mbostock/d3/wiki/Chord-Layout
     *
     *   c1 c2 c3 c4
     * c1 0  n  n  n
     * c2 n  0  n  n
     * c3 n  n  0  n
     * c4 n  n  n  0
     *
     * @todo optimize
     */

    $channels = array();
    $cPtr = array();
    $pushChannel = function($action, &$channels, &$ptr, $condensed) {
              if ($condensed) {
                $action = array_shift(explode('.', $action));
              }

              if (!in_array($action, $channels)) {
                array_push($channels, $action);
                $ptr[$action] = count($channels) - 1;
              }
            };

    foreach ($network['data'] as $chord => $strength) {
      list($from, $to) = explode(';', str_replace('#', '.', $chord));
      //$from = array_shift(explode('.', $from));
      //$to = array_shift(explode('.', $to));
      $pushChannel($from, $channels, $cPtr, $condensed);
      $pushChannel($to, $channels, $cPtr, $condensed);
    }

    $matrix = array_fill(0, count($channels), array_fill(0, count($channels), 0));

    foreach ($network['data'] as $chord => $strength) {
      //list($from, $to) = explode(';', str_replace('#', '.', $chord));
      if ($condensed) {
        list($from, $to) = explode(';', preg_replace('/#\w*/', '', $chord));
      } else {
        list($from, $to) = explode(';', str_replace('#', '.', $chord));
      }

      if (preg_match('/^bip/', $from)) {
        $generalStats['runningBips']['data'] += $strength;
      }


      $matrix[$cPtr[$from]][$cPtr[$to]] += $strength;
      if (!$matrix[$cPtr[$to]][$cPtr[$from]]) {
        /*
         * chords are technically to/from strength, so if there is no
         * reverse path, seed it with a nominal value for safe rendering
         * (the bezier attenuates if this value is too low).
         */
        $matrix[$cPtr[$to]][$cPtr[$from]] = 0.3;
      }
    }

    // javascript-ize
    $chordChannels = "['" . implode($channels, "','") . "']";
    $chordMatrix = '';
    for ($i = 0; $i < count($matrix); $i++) {
      if (!empty($chordMatrix)) {
        $chordMatrix .= ',';
      }
      $chordMatrix .= "[" . implode($matrix[$i], ',') . "]";
    }
    $chordMatrix = '[' . $chordMatrix . ']';
    return array($generalStats, $chordChannels, $chordMatrix);
  }

  /**
   * @todo refactor
   */
  public function getUserByEmail($email) {
    return $this->search('Account', array('email_account' => $email));
  }

  public function getAccountById($accountId) {
    $accounts = $this->search('Account', array('id' => $accountId));
    $account = array_pop($accounts);
    return $account;
  }

  public function getAccountByStripeId($customerId) {
    $accounts = $this->search('Account', array('stripe_customer_id' => $customerId));
    $account = array_pop($accounts);
    return $account;
  }

  /**
   *
   */
  public function getEmailVerifyByNonce($nonce) {
    return $this->search('EmailVerify', array('nonce' => $nonce));
  }

  /**
   *
   *
   * @param type $accessToken
   * @return type
   */
  public function getAccountByDCToken($accessToken) {
    $accountAuths = $this->search(
            'AccountAuth', array(
        'password' => $accessToken,
        'type' => 'dc_token'
            )
    );

    if (count($accountAuths) > 1) {
      throw new Exception('Too many tokens');
    }

    $accountAuth = array_pop($accountAuths);
    return $this->getAccountById($accountAuth['owner_id']);
  }

  public function getAccountByEmail($emailAddress) {
    $accounts = $this->search('Account', array('email_account' => $emailAddress));
    $account = array_pop($accounts);
    return $account;
  }

  public function getAccountLogin($username) {
    $accounts = $this->search('Account', array('username' => $username));
    $account = array_pop($accounts);
    return $account;
  }

  public function getAccountOptions($accountId) {
    $opts = $this->search('AccountOption', array('owner_id' => $accountId));
    $opt = array_pop($opts);
    return $opt;
  }

  public function bindSettings($accountOptions, &$settings) {
    $excl = array('owner_id', '_id');

    foreach ($accountOptions as $option => $value) {
      if (!in_array($option, $excl)) {
        $settings[$option] = $value;
      }
    }

    if (!isset($settings['avatar']) || '' === $settings['avatar']) {
      $settings['avatar'] = "/static/img/cdn/av/" . $accountOptions['owner_id'] . ".jpg";
    }

    return $settings;
  }

  public function getAuthPacket(array $account, array $accountOptions, $apiToken) {
    $options = Zend_Registry::get('config')->toArray();

    $settings = array(
        'name' => $account['name'],
        'username' => $account['username'],
        'account_level' => $account['account_level'],
        'plan_until' => $account['plan_until'],
        'email_account' => $account['email_account']
    );
    $auth = array();
    $auth['api_token'] = $apiToken;
    $auth['api_token_web'] = base64_encode($account['username'] . ':' . $apiToken);

    $auth['token_username'] =  $account['username'];
    $auth['auth_token'] = isset($accountOptions['remote_settings'])
      ? $accountOptions['remote_settings']['login']
      : '';

    $auth['ws_host'] = $settings['ws_host'] = $options['auth']['ws_host'];

    $this->bindSettings($accountOptions, $settings);




    /*
    if (self::checkAuthType() === 'auth_api') {

      $today = date('Y-m-d', mktime());
      $tomorrow = date('Y-m-d', mktime(0, 0, 0, date("m", $today), date("d", $today) +1 , date("Y", $today)));

      $authHost = $options['auth']['host'];

      //Zend_Rest_Client::getHttpClient();
      //$client = new Zend_Rest_Client($authHost);


      $username = $account['username'];
      $password = $apiToken;
      $tokenURI = '/login/wot';

      $username = 'logintest';
      $password = "pE23nHGCQk";

      Zend_Rest_Client::getHttpClient()->setAuth(
        $username,
        $password
      );

      $client = new Zend_Rest_Client($authHost);

      try {
        $response = $client->restGet($tokenURI);
        $respJSON = json_decode($response->getBody());

        $auth['auth_token'] =  $respJSON->login;
        $auth['token_username'] =  $username;
        $auth['ws_host'] = $options['auth']['ws_host'];
      } catch (Exception $e) {
      }
    }
  */

    // login? Then build the account container
    $result = array(
        'id' => $account['id'],
        'name' => $account['name'],
        'username' => $account['username'],
        'account_level' => $account['account_level'],
        'settings' => $settings,
        'auth' => $auth
    );

    return $result;
  }

  /**
   * Creates an 'authentication packet' which can be bound to the session
   *
   * @param type $account
   * @param type $password
   * @param type $authType
   * @return type
   */
  protected function _authAccountBind($account, $password) {
    $authPacket = NULL;

    $config = Zend_Registry::get('config');
    $options = $config->toArray();
    $authType = isset($options['auth']['type']) ? $options['auth']['type'] : 'login_primary';
    $authenticated = false;

    if (isset($account['id'])) {
      $params = array(
          'owner_id' => $account['id']
      );

      $accountAuths = $this->search('AccountAuth', $params);
      $user = null;
      $token = null;
      foreach ($accountAuths as $accountAuth) {
        if ('login_primary' == $accountAuth['type']) {
          $user = $accountAuth;
        } else if ('token' == $accountAuth['type']) {
          $token = Bip_Utility_Crypt::aesDecrypt($accountAuth['password']);
        } else if ('dc_token' == $accountAuth['type']) {
          $dcToken = $accountAuth['password']; // @todo crypt
        }
      }
    }

    $authenticatedPrimary = false;
    $authenticatedAPI = false;
    if($authType == 'login_mixed') {
    	$authenticatedPrimary = (isset($account['id']) && null !== $user && Bip_Model_AccountAuth::cmpPw($password, $user['password']));
    	if(!$authenticatedPrimary) {
	    	$authenticatedAPI = $this->authAPI($account, $password);
    	}
    }
    // local login (untracked)
    if ($authType == 'login_primary') {
    	$authenticated = (isset($account['id']) && null !== $user && Bip_Model_AccountAuth::cmpPw($password, $user['password']));
      // via DailyCred
    } else if ($authType == 'dc_token') {
      $authenticated = ($password == $dcToken); // @todo crypt, always true?

    } else if ($authType == 'auth_api') {
      $authenticated = $this->authAPI($account, $password);

    }

    if ($authenticated || $authenticatedPrimary || $authenticatedAPI) {
      // Token override (config)
      if ($options['api']['key'] !== 'none') {
        $token = $options['api']['key'];
      }

      if(isset($account['id'])) { //1st time ldap user sign in won't have an account if if not manually added
	      $accountOptions = $this->getAccountOptions($account['id']);
      }

      if ($authType == 'auth_api' || ($authenticatedAPI && $authType == 'login_mixed')) {
        //if ($authType == 'auth_api') {
          $token = $password;
        //}

        // newly boarding users will have details synced
        // into database, so refetch incase this is true
        $account = $this->getAccountLogin($account['username']);

        $accountOptions = $this->getAccountOptions($account['id']);
        if (isset($authenticated['remote_settings'])) {
          try {
            $accountOptions['remote_settings'] = $authenticated['remote_settings'];
          } catch (Exception $e) {
          }
        } else if (isset($authenticatedAPI['remote_settings'])) {
          try {
            $accountOptions['remote_settings'] = $authenticatedAPI['remote_settings'];
          } catch (Exception $e) {
          }
        }
      }

      $authPacket = $this->getAuthPacket($account, $accountOptions, $token);
    }
    return $authPacket;
  }

  public function authAPI($account, $password) {
        $config = Zend_Registry::get('config');
        $options = $config->toArray();
        $apiHost = isset($options['api']['host_local'])
          ? $options['api']['host_local']
          : $options['api']['host'];

        Zend_Rest_Client::getHttpClient()->setAuth($account['username'], $password);
        $client = new Zend_Rest_Client($apiHost);
        $response = $client->restGet('/login');

        if (200 === $response->getStatus()) {
            return json_decode($response->getBody(), true);
        } else {
            return false;
        }
    }

  /**
   * DailyCred token authentication
   *
   * @param type $accessToken
   * @return type
   */
  public function authenticateToken($accessToken) {
    $account = $this->getAccountByDCToken($accessToken);
    return $this->_authAccountBind($account, $accessToken, 'dc_token');
  }

  /**
   * Local authentication
   *
   * @param type $username
   * @param type $password
   * @return type
   */
  public function authenticate($username, $password) {
    $account = $this->getAccountLogin($username);
    if (empty($account)) {
    	$account = $this->getAccountByEmail($username);
    	if (empty($account)) {
	     	 $account = array(
		        'username' => $username
		      );
    	}
    }
    return $this->_authAccountBind($account, $password);
  }

  /**
   * @todo implement stub
   *
   * @param type $accessToken
   * @return type
   */
  public function dcGet($accessToken) {
    return array_pop($this->search('DailyCred', array('dc_access_token' => $accessToken)));
  }

  /**
   * Confirms a valid username
   *
   * @param type $username
   * @return boolean
   */
  public function checkUsername($username) {
    //$username = preg_replace('/[-_]/', '', strtolower($username));
    $username = strtolower($username);

    if (
            preg_match('/[^a-zA-Z0-9-]+/', $username) ||
            // preg_match('/.*[^-]$/', $username) || not ending with trailing '-'
            // reserved
            in_array($username, Bip_Model_Account::$reservedUsernames) ||
            // pluralized
            in_array(preg_replace('/s$/', '', $username), Bip_Model_Account::$reservedUsernames)
    // number prefixed or suffixed
    ) {
      return FALSE;
    }

    $account = $this->getAccountLogin($username);
    return empty($account);
  }

  public function updatePassword($accountId, $newPassword) {
    $collection = $this->_db->selectCollection('account_auths');

    $collection->update(
            array('owner_id' => $accountId, 'type' => 'login_primary'), array('$set' => array(
            'password' => Bip_Utility_Crypt::hash($newPassword),
            'owner_id' => $accountId,
            'type' => 'login_primary',
            'username' => ''
            ))
    );
  }

  public function setUserName($accountId, $name) {
    $account = array_pop($this->search(
                    'Account', array(
                'id' => $accountId
            )));

    if ($account) {

      $account['name'] = $name;

      unset($account['_id']);
      unset($account['__v']);

      $collection = $this->_db->selectCollection('accounts');
      $collection->update(
              array('id' => $accountId), $account
      );
    }
  }

  public function setNewPlan($accountId, $plan, $customerId, $until) {
    $account = array_pop(
      $this->search(
        'Account', array(
          'id' => $accountId
        )
      )
    );

    if ($account) {

      $account['account_level'] = $plan;
      $account['stripe_customer_id'] = $customerId;
      $account['plan_until'] = $until ? $until : date("Y-m-d", strtotime("+1 month"));

      unset($account['_id']);
      unset($account['__v']);

      $collection = $this->_db->selectCollection('accounts');
      $collection->update(
        array('id' => $accountId), $account
      );
      return true;
    } else {
      return false;
    }
  }

  public function updateKey($accountId) {
    $token = md5(Bip_Utility::randStr(32, 32, true));
    $collection = $this->_db->selectCollection('account_auths');

    $collection->update(
            array('owner_id' => $accountId, 'type' => 'token'), array(
        'password' => Bip_Utility_Crypt::aesEncrypt($token),
        'owner_id' => $accountId,
        'type' => 'token',
        'username' => ''
            )
    );

    return $token;
  }

  public function deleteAccountLauncher($ownerId) {
    $collection = $this->_db->selectCollection('account_auths');
    $collection->remove(array('owner_id' => $ownerId, 'type' => 'token_invite'));
  }

  public function getAccountLauncher($launchKey) {
    $accountAuths = $this->search(
            'AccountAuth', array(
        'password' => $launchKey,
        'type' => 'token_invite'
            )
    );

    if (count($accountAuths) > 1) {
      throw new Exception('Too many tokens');
    }

    $accountAuth = array_pop($accountAuths);
    if ($accountAuth) {
      return $this->getAccountById($accountAuth['owner_id']);
    } else {
      return null;
    }
  }

  public function getAccountLaunchKeyByEmail($emailAddress) {
    $account = $this->getAccountByEmail($emailAddress);

    if ($account) {
      $accountAuths = $this->search(
              'AccountAuth', array(
          'owner_id' => $account['id'],
          'type' => 'token_invite'
              )
      );

      if (count($accountAuths) > 1) {
        throw new Exception('Too many tokens');
      }

      $accountAuth = array_pop($accountAuths);
      if ($accountAuth) {
        return $accountAuth['password'];
      }
    }

    return null;
  }

  public function getChannel($channelId) {
    $collection = $this->_db->selectCollection('channels');
    $channels = $this->search('Channel', array('id' => $channelId));
    $channel = array_pop($channels);
    return $channel;
  }

  public function createUser($name, $email, $username) {
    $account = array(
     'id' => Bip_Utility::uuidV4(),
     'name' => $name,
     'email_account' => $email,
     'username' => $username,
     'account_level' => 'user',
     'created' => time()
    );

    $collection = $this->_db->selectCollection('accounts');
    $collection->save($account);

    return $account;
  }

  /**
   * Creates a new user in the system (trusted sources)
   *
   * @param type $userName
   * @param type $accessToken
   */
  public function installUser($account, $userName, $accessToken = NULL, $password = NULL) {

    $email = $account['email_account'];
    $accountId = $account['id'];

    $pictureUrl = $this->generateAv($accountId, $email);

    // install password
    if (null !== $password) {
      $accountAuth = array(
          'id' => Bip_Utility::uuidV4(),
          'owner_id' => $accountId,
          'password' => Bip_Utility_Crypt::hash($password),
          'type' => 'login_primary',
          'username' => ''
      );

      $collection = $this->_db->selectCollection('account_auths');
      $collection->save($accountAuth);
    }

    // -------------------------------------------
    // update account username
    $account['username'] = $account['name'] = $userName;
    if (isset($dcGraph['name'])) {
      $account['name'] = $dcGraph['name'];
    }
    $collection = $this->_db->selectCollection('accounts');
    $collection->update(array('id' => $account['id']), $account);

    // -------------------------------------------
    // install API token
    $token = md5(Bip_Utility::randStr(32, 32, true));
    $accountAuth = array(
        'id' => Bip_Utility::uuidV4(),
        'owner_id' => $accountId,
        'password' => Bip_Utility_Crypt::aesEncrypt($token),
        'type' => 'token',
        'username' => ''
    );

    $collection = $this->_db->selectCollection('account_auths');
    $collection->save($accountAuth);


    // -------------------------------------------
    // install default channel
    // @todo should be a API calls
    $channelId = Bip_Utility::uuidV4();
    $channel = array(
        "id" => $channelId,
        "owner_id" => $accountId,
        "name" => $email,
        "action" => "email.smtp_forward",
        "available" => true,
        "config" => array(
            'rcpt_to' => $email,
            'icon_url' => $pictureUrl
        ),
        'note' => 'Default Email'
    );
    $collection = $this->_db->selectCollection('channels');
    $collection->save($channel);

    // create smtp_forward verify channel
    $verify = array(
        'id' => Bip_Utility::uuidV4(),
        "owner_id" => $accountId,
        "none" => Bip_Utility::uuidV4() . '_signup',
        "mode" => "accept",
        "email_verify" => $email,
        "num_sent" => 1
    );
    $collection = $this->_db->selectCollection('pod_email_verifies');
    $collection->save($verify);

    // create public feed
    $feedChannelId = Bip_Utility::uuidV4();
    $channel = array(
        "id" => $feedChannelId,
        "owner_id" => $accountId,
        "name" => 'Public Feed',
        "action" => "syndication.feed",
        "available" => true,
        "config" => array(),
        'note' => 'Your public feed'
    );
    $collection = $this->_db->selectCollection('channels');
    $collection->save($channel);

    // create public feed container
    $feedId = Bip_Utility::uuidV4();
    $feed = array(
        "id" => $feedId,
        "owner_id" => $accountId,
        "channel_id" => $feedChannelId
    );
    $collection = $this->_db->selectCollection('pod_syndication_feeds');
    $collection->save($feed);

    // -------------------------------------------
    // install default domain
    // @todo should be a API calls
    $domainId = Bip_Utility::uuidV4();
    $domain = array(
        'id' => $domainId,
        "owner_id" => $accountId,
        'name' => $userName . '.' . $this->_options['env']['hostname_users'],
        "type" => "vanity",
        "renderer" => array(
            //"channel_id" => $feedChannelId,
            //"renderer" => "default"
          "pod" => "profile",
          "renderer" => "get_profile"
        ),
        "_available" => true
    );

    $collection = $this->_db->selectCollection('domains');
    $collection->save($domain);

    // -------------------------------------------
    // create options
    // @todo should be a API calls
    $optionId = Bip_Utility::uuidV4();
    $opts = array(
        "id" => $optionId,
        "owner_id" => $accountId,
        "timezone" => "America/New_York",
        "avatar" => $pictureUrl,
        "bip_config" => array(),
        "bip_hub" => array(
            'source' => array(
                'edges' => array($channelId),
                'transforms' => array(
                    $channelId => 'blog'
                )
            )
        ),
        "bip_domain_id" => $domainId,
        "bip_end_life" => array(
            "imp" => 0,
            "time" => 0
        ),
        "tos_accept" => true,
        "bip_expire_behaviour" => "pause",
        "bip_type" => "smtp",
        "bip_anonymize" => 1
    );

    $collection = $this->_db->selectCollection('account_options');
    $collection->save($opts);

    // drop beta if any exist
    $collection = $this->_db->selectCollection('account_auth');
    $filter = array(
        'owner_id' => $account['id'],
        'type' => 'token_invite'
    );
    $result = $collection->remove($filter, array('w' => 1));

    return $this->getAuthPacket($account, $opts, $token);
  }

  public function generateAv($accountId, $email) {

    $pictureUrl = '/static/img/cdn/av/' . $accountId . '.png';

    $contents = false;

    if (function_exists('curl_init')) {
      try {
        // get identicon (https://github.com/cupcake/sigil)
        $curl = curl_init();
        $fp = fopen(APPLICATION_PATH . "/../public" . $pictureUrl, "w");
        curl_setopt($curl, CURLOPT_URL, 'https://sigil.cupcake.io/' . $email);
        curl_setopt($curl, CURLOPT_FILE, $fp);

        curl_setopt($curl, CURLOPT_RETURNTRANSFER, TRUE);

        $contents = curl_exec($curl);
        fwrite($fp, $contents);
        curl_close($curl);
        fclose($fp);
      } catch (Exception $e) {

      }
    }

    if (!$contents) {
      copy(APPLICATION_PATH . '/../public/static/img/noav.png', APPLICATION_PATH . "/../public" . $pictureUrl);
    }

    system('convert ' . APPLICATION_PATH . "/../public" . $pictureUrl . '  ' . APPLICATION_PATH . '/../public/static/img/cdn/av/' . $accountId . '.jpg');

    return $pictureUrl;
  }

  public function createToken($accountId) {
    $resetToken = base64_encode(
            Bip_Utility_Crypt::aesEncrypt(
                    time() . ':' . $accountId . ':' . Bip_Utility::uuidV4()
            )
    );
    $pwToken = array(
        'id' => Bip_Utility::uuidV4(),
        'owner_id' => $accountId,
        'password' => $resetToken,
        'type' => 'reset_token',
        'createdts' => time(),
    );
    $collection = $this->_db->selectCollection('account_auths');
    $collection->save($pwToken);
    return $resetToken;
  }

  public function confirmToken($account, $token) {
    $ok = false;

    $accountAuths = array_pop($this->search(
      'AccountAuth',
      array(
        'owner_id' => $account['id'],
        'password' => $token,
        'type' => 'reset_token'
      )
    ));

    if ($accountAuths) {
      $decrypted = Bip_Utility_Crypt::aesDecrypt(base64_decode($token));
      list($ts, $accountId, $token) = split(':', $decrypted);

      // within 5 days
      if ($ts >= (time() - 60 * 60 * 24 * 5 ) && $accountId == $account['id']) {
        return TRUE;
      } else {
        return FALSE;
      }
    }

    return $ok;
  }

  public function destroyToken($account, $token) {
    $ok = false;

    if ($account && $token) {
      $collection = $this->_db->selectCollection('account_auths');
      $collection->remove(
        array(
          'owner_id' => $account['id'],
          'type' => 'reset_token'
        )
      );
    }

    // @todo - should also destroy old tokens
    $collection = $this->_db->selectCollection('account_auths');
      $collection->remove(
        array(
          'createdts' => array(
              '$lt' => (time() - 60 * 60 * 24 * 5 )
          ),
          'type' => 'reset_token'
        )
      );

  }

}
