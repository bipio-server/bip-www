<?php
/*
* update user creation date from mail chimp user timestamp.
*/
 try {
	$server = 'mongodb://172.17.42.1';
	$db = 'bipio';
	$url = 'https://us3.api.mailchimp.com/2.0/lists/member-info.json';
	$mailChimpApiKey = 'ac7be895fb859050a4cf6316ec74f815-us3';
	$chimpListId = 'b56498e932';

   	$m = new MongoClient($server);
	$db = $m->selectDB($db);
	$collection = $m->bipio->accounts;
	$cursor = $collection->find();
	$emails = array();	
	foreach ( $cursor as $id => $value )
	{	
		$creation_date = $value["created"];
		if(!$creation_date || $creation_date == NULL ||  $creation_date = 0){
			$emails[]= array(
				'email' =>  $value["email_account"]
			);
		}
	}

	$length = count($emails);
	
	for($i = 0 ; $i < $length ; $i+=40){
		$sliced_emails = array_slice($emails, $i, 40);
		$args =	array(
		        'id'      => $chimpListId,
			'apikey'  => $mailChimpApiKey,
		        'emails'  => $sliced_emails   
		);

		$json_data = json_encode($args);

	       if (function_exists('curl_init') && function_exists('curl_setopt')) {
		    $ch = curl_init();
		    curl_setopt($ch, CURLOPT_URL, $url);
		    curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
		    curl_setopt($ch, CURLOPT_USERAGENT, 'PHP-MCAPI/2.0');
		    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		    curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
		    curl_setopt($ch, CURLOPT_POST, true);  
		    curl_setopt($ch, CURLOPT_POSTFIELDS, $json_data);
		    $result = curl_exec($ch);
		    curl_close($ch);
		} else {
		    $result    = file_get_contents($url, null, stream_context_create(array(
		        'http' => array(
		            'protocol_version' => 1.1,
		            'user_agent'       => 'PHP-MCAPI/2.0',
		            'method'           => 'POST',
		            'header'           => "Content-type: application/json\r\n".
		                                  "Connection: close\r\n" .
		                                  "Content-length: " . strlen($json_data) . "\r\n",
		            'content'          => $json_data,
		        ),
		    )));
	      
		}
     	
		$results = json_decode($result);
		if($results->success_count > 0){
			$users = $results->data;
			foreach($users as $user){
				$creation_date = NULL;
				if($user->timestamp_signup){
					$creation_date = strtotime($user->timestamp_signup);
				}else{
					if($user->timestamp_opt && $user->timestamp){
						$opt = $user->timestamp_opt;
						$u_timestamp = $user->timestamp;
						$opt_date = strtotime($opt);
						$u_date = strtotime($u_timestamp);
						if($opt_date < $u_date){
							$creation_date = $opt_date;
						}else{
							$creation_date = $u_date;
						}
					
					}else{
						if($user->timestamp_opt){
							 $creation_date = strtotime($user->timestamp_opt);
						}else{
							 $creation_date = strtotime($user->timestamp);
						}
					}
				}

				// update mongodb
				if($creation_date){
					$criteria = array("email_account"=>$user->email);
					$newdata = array('$set'=>array("created"=>$creation_date));
					$options = array("upsert"=>true,"multiple"=>false);
				 
					$ret = $collection->update(
					    $criteria,
					    $newdata,
					    $options
					);

				}
			
			}
		} 
	}
	echo ' success' ;
} catch (Exception $e) {
         echo 'Caught exception: ',  $e->getMessage(), "\n";

}
?>
